import logger from './utils/logger.js';
import { randomBetween, getSystemState, updateSystemState } from './utils/helpers.js';
import { RuntimeStateService } from '../backend-api/services/RuntimeStateService.js';

export function calculateNextRun(from = new Date()) {
  const next = new Date(from);
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0); // Default 9 AM
  const offset = randomBetween(-45, 45);
  next.setMinutes(next.getMinutes() + offset);
  return next;
}

export async function runScheduler(tasks) {
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
      logger.info('Scheduler: Starting daily workflows...');
      for (const task of tasks) {
        if (RuntimeStateService.getFlag('emergency_stop')) {
          logger.info('Scheduler: Emergency stop detected during task execution. Stopping further tasks.');
          break;
        }

        try {
          await task();
        } catch (error) {
          logger.error(`Scheduler: Task failed`, { message: error.message });
        }
        
        if (RuntimeStateService.getFlag('emergency_stop')) {
          logger.info('Scheduler: Emergency stop detected after task completion. Stopping further tasks.');
          break;
        }

        const gap = randomBetween(2, 10) * 60000;
        logger.info(`Scheduler: Waiting ${gap / 60000} minutes before next task...`);
        await new Promise(r => setTimeout(r, gap));
      }

      if (RuntimeStateService.getFlag('emergency_stop')) {
        break;
      }

      nextRun = calculateNextRun();
      await updateSystemState({ 
        lastCompletedRun: now.toISOString(),
        nextScheduledRun: nextRun.toISOString()
      });
      logger.info(`Scheduler: Daily cycle complete. Next run: ${nextRun.toISOString()}`);
    }
    // Check every minute
    await new Promise(r => setTimeout(r, 60000));
  }
}
