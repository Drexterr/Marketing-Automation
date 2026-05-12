import { runScheduler } from './scheduler.js';
import { RuntimeStateService } from '../backend-api/services/RuntimeStateService.js';
import { SqliteRepository } from '../shared/repositories/SqliteRepository.js';
import assert from 'node:assert';
import test from 'node:test';

test('runScheduler correctly tracks records_processed from tasks', async () => {
    const runsRepo = new SqliteRepository('scheduler_runs');
    const originalSetPulse = RuntimeStateService.setPulse;
    const originalSetTimeout = global.setTimeout;
    const originalDateNow = Date.now;
    
    let mockTime = Date.now();
    global.Date.now = () => mockTime;
    
    // Mock setTimeout to resolve immediately but increment mock time
    global.setTimeout = (fn, ms) => {
        mockTime += ms;
        return originalSetTimeout(fn, 0);
    };

    // 1. Setup tasks that return different recordsProcessed
    const tasks = [
        async function task1() {
            return { recordsProcessed: 5 };
        },
        async function task2() {
            return { recordsProcessed: 3 };
        },
        async function task3() {
            // Task with no return or different format should not break it
            return {};
        },
        async function task4() {
            return { recordsProcessed: 2 };
        }
    ];

    // Trigger immediate run
    const past = new Date(mockTime - 1000);
    RuntimeStateService.setFlag('system_state', { nextScheduledRun: past.toISOString() });

    // Set emergency stop to trigger after all tasks are done
    RuntimeStateService.setPulse = (data) => {
        if (data.activeTask === 'Waiting after task4' && data.progressPercent === 100) {
            RuntimeStateService.setFlag('emergency_stop', true);
        }
    };

    try {
        await runScheduler(tasks);

        // Get the latest run from DB
        const latestRun = runsRepo.db.prepare('SELECT * FROM scheduler_runs ORDER BY id DESC LIMIT 1').get();
        
        assert.strictEqual(latestRun.records_processed, 10, 'Total records processed should be 10 (5+3+2)');
    } finally {
        RuntimeStateService.setPulse = originalSetPulse;
        global.setTimeout = originalSetTimeout;
        global.Date.now = originalDateNow;
        RuntimeStateService.setFlag('emergency_stop', false);
        RuntimeStateService.setFlag('system_state', null);
    }
});
