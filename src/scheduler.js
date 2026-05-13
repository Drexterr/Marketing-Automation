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
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const pid = fs.readFileSync(LOCK_FILE, 'utf8');
      process.kill(parseInt(pid, 10), 0);
      logger.error(`Scheduler: Another instance (PID ${pid}) is already running. Exiting.`);
      return false;
    } catch (e) {
      logger.info('Scheduler: Removing stale lock file.');
      fs.unlinkSync(LOCK_FILE);
    }
  }
  fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
  fs.writeFileSync(LOCK_FILE, process.pid.toString());
  return true;
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
  process.on('SIGINT', () => { releaseLock(); process.exit(); });
  process.on('SIGTERM', () => { releaseLock(); process.exit(); });

  await performCrashRecovery();

  logger.info('Scheduler: Initialized independent cron jobs.');
  RuntimeStateService.setWorkflowState('IDLE');

  tasks.forEach((task, index) => {
    const minuteOffset = (index * 5) % 60;
    cron.schedule(`${minuteOffset} * * * *`, async () => {
      if (RuntimeStateService.getFlag('emergency_stop')) return;
      if (RuntimeStateService.getWorkflowState() === 'RUNNING') {
          logger.info(`Skipping ${task.name || 'task'} - another task is running.`);
          return;
      }
      
      RuntimeStateService.setWorkflowState('RUNNING');
      try {
         await task();
      } finally {
         RuntimeStateService.setWorkflowState('IDLE');
      }
    });
  });
}
