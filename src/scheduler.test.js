import { calculateNextRun, runScheduler } from './scheduler.js';
import { RuntimeStateService } from '../backend-api/services/RuntimeStateService.js';
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

test('runScheduler stops immediately when emergency_stop is set', async () => {
    // Set the emergency stop flag in the runtime state
    RuntimeStateService.setFlag('emergency_stop', true);
    
    let taskCalled = false;
    const task = async () => { 
        taskCalled = true; 
    };

    // This should return immediately because the flag is checked at the start of the loop
    // We wrap it in a timeout to ensure it doesn't hang if the test fails
    const schedulerPromise = runScheduler([task]);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Scheduler hung')), 2000));
    
    try {
        await Promise.race([schedulerPromise, timeoutPromise]);
    } finally {
        // Clean up
        RuntimeStateService.setFlag('emergency_stop', false);
    }
    
    assert.strictEqual(taskCalled, false, 'Task should not have been called when emergency_stop is true');
});

test('runScheduler stops after first task when emergency_stop is set during execution', async () => {
    let tasksCalled = 0;
    const tasks = [
        async () => { 
            tasksCalled++; 
            // Trigger emergency stop during the first task
            RuntimeStateService.setFlag('emergency_stop', true);
        },
        async () => { 
            tasksCalled++; 
        }
    ];

    // Mock getSystemState to return a date in the past so it runs immediately
    // Since we can't easily mock imports in node:test without extra libs, 
    // we'll rely on the fact that if we don't have a state, it might wait or run.
    // Actually, runScheduler reads state. 
    
    // Set up state to trigger immediate run
    const now = new Date();
    const past = new Date(now.getTime() - 1000);
    RuntimeStateService.setFlag('system_state', { nextScheduledRun: past.toISOString() });

    const schedulerPromise = runScheduler(tasks);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Scheduler hung')), 5000));
    
    try {
        await Promise.race([schedulerPromise, timeoutPromise]);
    } finally {
        // Clean up
        RuntimeStateService.setFlag('emergency_stop', false);
        RuntimeStateService.setFlag('system_state', null);
    }
    
    assert.strictEqual(tasksCalled, 1, 'Only the first task should have been called');
});

test('runScheduler stops after tasks but before rescheduling when emergency_stop is set', async () => {
    let taskCalled = false;
    const tasks = [
        async () => { 
            taskCalled = true; 
        }
    ];

    // Set up state to trigger immediate run
    const now = new Date();
    const past = new Date(now.getTime() - 1000);
    RuntimeStateService.setFlag('system_state', { nextScheduledRun: past.toISOString() });

    // We need to set the flag AFTER the task finishes but BEFORE rescheduling.
    // This is hard to time without mocking. 
    // However, the current code checks it multiple times.
    
    // Let's modify the task to set the flag.
    const tasksWithStop = [
        async () => {
            taskCalled = true;
            RuntimeStateService.setFlag('emergency_stop', true);
        }
    ];

    const schedulerPromise = runScheduler(tasksWithStop);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Scheduler hung')), 5000));
    
    try {
        await Promise.race([schedulerPromise, timeoutPromise]);
    } finally {
        RuntimeStateService.setFlag('emergency_stop', false);
    }
    
    assert.strictEqual(taskCalled, true, 'Task should have been called');
    
    // Verify that nextScheduledRun was NOT updated to a future date
    const state = RuntimeStateService.getFlag('system_state') || {};
    // If it Rescheduled, it would have a new nextScheduledRun date
    // But since it stops, it might not have updated it yet OR it updated it before stop.
    // Looking at src/scheduler.js:
    /*
      if (RuntimeStateService.getFlag('emergency_stop')) {
        break;
      }

      nextRun = calculateNextRun();
      await updateSystemState({ ... });
    */
    // So it SHOULD break before updateSystemState.
    
    assert.strictEqual(state.nextScheduledRun, past.toISOString(), 'nextScheduledRun should not have been updated');
});
