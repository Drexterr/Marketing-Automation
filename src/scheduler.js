import logger from './utils/logger.js';
import { randomBetween, getSystemState, updateSystemState, withTimeout } from './utils/helpers.js';
import { RuntimeStateService } from '../backend-api/services/RuntimeStateService.js';
import { SqliteRepository } from '../shared/repositories/SqliteRepository.js';
import fs from 'node:fs';
import path from 'node:path';

const LOCK_FILE = path.join(process.cwd(), 'data', 'scheduler.lock');
const runsRepo = new SqliteRepository('scheduler_runs');

async function interruptibleSleep(ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (RuntimeStateService.getFlag('emergency_stop')) {
      return true; // interrupted
    }
    // Poll every 3 seconds
    await new Promise(r => setTimeout(r, Math.min(3000, ms - (Date.now() - start))));
  }
  return false; // completed fully
}

export function calculateNextRun(from = new Date()) {
  const next = new Date(from);
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0); // Default 9 AM
  const offset = randomBetween(-45, 45);
  next.setMinutes(next.getMinutes() + offset);
  return next;
}

export async function runScheduler(tasks) {
  // Overlap prevention: PID lock file
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const pid = fs.readFileSync(LOCK_FILE, 'utf8');
      process.kill(parseInt(pid, 10), 0); // Check if process exists
      logger.error(`Scheduler: Another instance (PID ${pid}) is already running. Exiting.`);
      process.exit(1);
    } catch (e) {
      logger.info('Scheduler: Removing stale lock file.');
      fs.unlinkSync(LOCK_FILE);
    }
  }
  
  fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
  fs.writeFileSync(LOCK_FILE, process.pid.toString());
  logger.info(`Scheduler: Started with PID ${process.pid} and acquired lock.`);

  // CRASH RECOVERY: Mark incomplete runs as failed
  try {
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

    // Recover orphaned connections
    const orphanedConnections = runsRepo.db.prepare(`SELECT id, profile_url, status FROM connections WHERE status IN ('pending', 'sending_connection')`).all();
    if (orphanedConnections.length > 0) {
      for (const conn of orphanedConnections) {
        runsRepo.db.prepare(`UPDATE connections SET status = 'failed', last_action = 'crash_recovery', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(conn.id);
        logger.warn(`Recovered orphaned connection ${conn.profile_url} and marked as failed.`);
      }
    }
  } catch (e) {
    logger.error('Failed to perform crash recovery', { error: e.message });
  }

  let currentRunId = null;
  const cleanup = () => {
    if (currentRunId) {
      try {
        runsRepo.update(currentRunId, {
          status: RuntimeStateService.getFlag('emergency_stop') ? 'failed' : 'completed',
          end_time: new Date().toISOString(),
          graceful_shutdown: 1,
          failure_reason: RuntimeStateService.getFlag('emergency_stop') ? 'Emergency stopped' : null
        });
      } catch (e) {}
    }
    if (fs.existsSync(LOCK_FILE)) {
      try {
        fs.unlinkSync(LOCK_FILE);
        logger.info('Scheduler: Lock file removed.');
      } catch (e) {
        // ignore
      }
    }
  };
  
  // Ensure lock is removed on exit
  process.on('exit', cleanup);

  const state = await getSystemState();
  let nextRun = state.nextScheduledRun ? new Date(state.nextScheduledRun) : calculateNextRun();
  
  logger.info(`Scheduler: Next run scheduled for ${nextRun.toISOString()}`);
  
  while (true) {
    if (RuntimeStateService.getFlag('emergency_stop')) {
      logger.info('Scheduler: Emergency stop active. Exiting scheduler loop.');
      break;
    }

    const now = new Date();
    if (now >= nextRun) {
      const runRecord = runsRepo.create({
        start_time: now.toISOString(),
        status: 'running',
        records_processed: 0
      });
      currentRunId = runRecord.id;

      RuntimeStateService.setPulse({ status: 'ACTIVE', activeTask: 'Starting workflows' });
      logger.info('Scheduler: Starting daily workflows...');
      
      let totalRecords = 0;
      for (const task of tasks) {
        if (RuntimeStateService.getFlag('emergency_stop')) {
          logger.info('Scheduler: Emergency stop detected during task execution. Stopping further tasks.');
          break;
        }

        RuntimeStateService.setPulse({ status: 'ACTIVE', activeTask: task.name || 'Running task', progressPercent: 0 });
        try {
          // 15-minute timeout per major task
          const result = await withTimeout(task(), 15 * 60 * 1000, task.name || 'Anonymous Task');
          if (result && result.recordsProcessed) {
            totalRecords += result.recordsProcessed;
            runsRepo.update(currentRunId, { records_processed: totalRecords });
          }
        } catch (error) {
          logger.error(`Scheduler: Task failed or timed out`, { message: error.message });
          try {
            runsRepo.update(currentRunId, { failure_reason: error.message });
          } catch (e) {}
        }
        
        RuntimeStateService.setPulse({ status: 'ACTIVE', activeTask: `Waiting after ${task.name || 'task'}`, progressPercent: 100 });

        if (RuntimeStateService.getFlag('emergency_stop')) {
          logger.info('Scheduler: Emergency stop detected after task completion. Stopping further tasks.');
          break;
        }

        const gap = randomBetween(2, 10) * 60000;
        logger.info(`Scheduler: Waiting ${gap / 60000} minutes before next task...`);
        
        const interrupted = await interruptibleSleep(gap);
        if (interrupted) {
          logger.info('Scheduler: Sleep interrupted by emergency stop.');
          break;
        }
      }

      if (RuntimeStateService.getFlag('emergency_stop')) {
        break;
      }

      RuntimeStateService.setPulse({ status: 'IDLE', activeTask: 'Cycle complete' });
      nextRun = calculateNextRun();
      
      try {
        runsRepo.update(currentRunId, {
          status: 'completed',
          end_time: new Date().toISOString(),
          duration: Date.now() - now.getTime(),
          graceful_shutdown: 1
        });
      } catch (e) {}
      currentRunId = null;

      await updateSystemState({ 
        lastCompletedRun: now.toISOString(),
        nextScheduledRun: nextRun.toISOString()
      });
      logger.info(`Scheduler: Daily cycle complete. Next run: ${nextRun.toISOString()}`);
    } else {
      RuntimeStateService.setPulse({ status: 'IDLE', activeTask: 'Sleeping' });
    }
    
    // Check every minute or until emergency stop
    const interrupted = await interruptibleSleep(60000);
    if (interrupted) break;
  }
  
  cleanup();
}
