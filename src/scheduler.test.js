import { calculateNextRun } from './scheduler.js';
import assert from 'node:assert';
import test from 'node:test';

test('scheduler delay calculation', () => {
  const now = new Date();
  const nextRun = calculateNextRun(now);
  
  // Create a date for 9 AM next day to compare
  const expectedBase = new Date(now);
  expectedBase.setDate(expectedBase.getDate() + 1);
  expectedBase.setHours(9, 0, 0, 0);
  
  const diffMinutes = (nextRun - expectedBase) / (1000 * 60);
  
  assert(Math.abs(diffMinutes) <= 45, `Difference was ${diffMinutes} minutes, expected <= 45`);
});
