import logger from './utils/logger.js';
import { randomBetween, getSystemState, updateSystemState } from './utils/helpers.js';

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
    const now = new Date();
    if (now >= nextRun) {
      logger.info('Scheduler: Starting daily workflows...');
      for (const task of tasks) {
        try {
          await task();
        } catch (error) {
          logger.error(`Scheduler: Task failed`, { message: error.message });
        }
        const gap = randomBetween(2, 10) * 60000;
        logger.info(`Scheduler: Waiting ${gap / 60000} minutes before next task...`);
        await new Promise(r => setTimeout(r, gap));
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
