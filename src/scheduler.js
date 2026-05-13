import logger from './utils/logger.js';
import { RuntimeStateService } from '../backend-api/services/RuntimeStateService.js';
import { SqliteRepository } from '../shared/repositories/SqliteRepository.js';
import { ConnectionRepository } from '../shared/repositories/ConnectionRepository.js';
import { ActivityRepository } from '../shared/repositories/ActivityRepository.js';
import fs from 'node:fs';
import path from 'node:path';
import cron from 'node-cron';

const LOCK_FILE = path.join(process.cwd(), 'data', 'scheduler.lock');
const runsRepo = new SqliteRepository('scheduler_runs');
const connectionRepo = new ConnectionRepository();
const activityRepo = new ActivityRepository();

async function performCrashRecovery() {
  try {
    activityRepo.cleanupOldLogs(30);

    const incompleteRuns = runsRepo.db.prepare(`SELECT * FROM scheduler_runs WHERE status = 'running'`).all();
    for (const run of incompleteRuns) {
      runsRepo.update(run.id, {
        status: 'failed',
        end_time: new Date().toISOString(),
        failure_reason: 'System crashed or was forcibly terminated',
        graceful_shutdown: 0
      });
      logger.warn(`Recovered incomplete run ${run.id} and marked as failed.`);
    }

    const orphanedConnections = connectionRepo.db.prepare(`SELECT id, profile_url FROM connections WHERE state IN ('pending', 'sending_connection')`).all();
    if (orphanedConnections.length > 0) {
      connectionRepo.db.prepare(`UPDATE connections SET state = 'failed', updated_at = CURRENT_TIMESTAMP WHERE state IN ('pending', 'sending_connection')`).run();
      for (const conn of orphanedConnections) {
        logger.warn(`Recovered orphaned connection ${conn.profile_url} and marked as failed.`);
      }
    }
  } catch (e) {
    logger.error('Failed to perform crash recovery', { error: e.message });
  }
}

function acquireLock() {
  fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
  try {
    const fd = fs.openSync(LOCK_FILE, 'wx');
    fs.writeSync(fd, process.pid.toString());
    fs.closeSync(fd);
    return true;
  } catch (err) {
    if (err.code === 'EEXIST') {
      try {
        const pid = fs.readFileSync(LOCK_FILE, 'utf8');
        if (pid) {
          process.kill(parseInt(pid, 10), 0);
          logger.error(`Scheduler: Another instance (PID ${pid}) is already running. Exiting.`);
          return false;
        }
      } catch (e) {
        // ESRCH (process dead) or read error
        logger.info('Scheduler: Removing stale lock file.');
        try { fs.unlinkSync(LOCK_FILE); } catch (ignore) {}
        try {
          const fd = fs.openSync(LOCK_FILE, 'wx');
          fs.writeSync(fd, process.pid.toString());
          fs.closeSync(fd);
          return true;
        } catch (retryErr) {
          return false;
        }
      }
    }
    logger.error('Failed to acquire lock', { error: err.message });
    return false;
  }
}

function releaseLock() {
  if (fs.existsSync(LOCK_FILE)) {
    try {
      fs.unlinkSync(LOCK_FILE);
      logger.info('Scheduler: Lock file removed.');
    } catch (e) {}
  }
}

export async function runScheduler(tasks) {
  if (!acquireLock()) process.exit(1);
  process.on('exit', releaseLock);

  await performCrashRecovery();

  logger.info('Scheduler: Initialized independent cron jobs.');
  RuntimeStateService.setWorkflowState('IDLE');

  const randomConnectMinute = Math.floor(Math.random() * 60);
  const defaultSchedules = {
    connect: `${randomConnectMinute} 9 * * 1,3,5`,
    replies: `0 9-17/2 * * 1-5`,
    followups: `0 20 * * *`,
    feed: `30 10 * * 1-5`,
    post: `45 11 * * 2,4`,
    analytics: `0 23 * * *`
  };

  tasks.forEach((task, index) => {
    const taskName = task.name || `task_${index}`;
    let scheduleExpr = defaultSchedules[taskName];
    if (!scheduleExpr) {
      const minuteOffset = (index * 5) % 60;
      scheduleExpr = `${minuteOffset} * * * *`;
    }
    
    logger.info(`Scheduling ${taskName} with expression: ${scheduleExpr}`);

    cron.schedule(scheduleExpr, async () => {
      if (RuntimeStateService.getFlag('emergency_stop')) return;
      if (RuntimeStateService.getWorkflowState() === 'RUNNING') {
          logger.info(`Skipping ${taskName} - another task is running.`);
          return;
      }
      
      RuntimeStateService.setWorkflowState('RUNNING');
      RuntimeStateService.updatePulse({ activeTask: taskName, progress: 0, status: 'RUNNING' });

      const startTime = new Date();
      let runId = null;
      let runStatus = 'completed';
      let failureReason = null;
      let recordsProcessed = 0;

      // Global Task Watchdog: 20 minute hard limit per task
      const controller = new AbortController();
      const watchdog = setTimeout(() => {
          logger.error(`WATCHDOG: Task ${taskName} exceeded 20m limit. Aborting.`);
          controller.abort();
      }, 20 * 60 * 1000);

      try {
         const run = runsRepo.db.prepare(`
            INSERT INTO scheduler_runs (task_name, start_time, status)
            VALUES (?, ?, 'running')
         `).run(taskName, startTime.toISOString());
         runId = run.lastInsertRowid;
         
         const result = await task(controller.signal);
         if (result && result.recordsProcessed !== undefined) {
             recordsProcessed = result.recordsProcessed;
         }
      } catch (error) {
         runStatus = 'failed';
         failureReason = error.message;
         logger.error(`Task ${taskName} failed`, { error: error.message });
      } finally {
         clearTimeout(watchdog);
         const endTime = new Date();
         const duration = endTime.getTime() - startTime.getTime();
         if (runId) {
             runsRepo.db.prepare(`
                 UPDATE scheduler_runs 
                 SET end_time = ?, status = ?, failure_reason = ?, duration = ?, records_processed = ?
                 WHERE id = ?
             `).run(endTime.toISOString(), runStatus, failureReason, duration, recordsProcessed, runId);
         }
         RuntimeStateService.setWorkflowState('IDLE');
         RuntimeStateService.updatePulse({ activeTask: null, progress: 0, status: 'IDLE' });
      }
    });
  });
}
