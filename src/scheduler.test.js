import assert from 'node:assert';
import { describe, it } from 'node:test';
import { runScheduler } from './scheduler.js';

describe('Scheduler Refactor', () => {
  it('does not contain while-loop interruptibleSleep', () => {
    assert.strictEqual(runScheduler.toString().includes('interruptibleSleep'), false);
  });
});
