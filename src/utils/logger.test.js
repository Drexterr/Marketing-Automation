import { test } from 'node:test';
import assert from 'node:assert/strict';
import logger from './logger.js';
import { ActivityRepository } from '../../shared/repositories/ActivityRepository.js';

test('Logger SQLite integration', async (t) => {
    const activityRepo = new ActivityRepository();
    
    await t.test('should log info messages to sqlite', async () => {
        activityRepo.clear();
        const testMessage = `Test log message ${Date.now()}`;
        
        logger.info(testMessage, { module: 'test_module' });
        
        // Winston logging might be async, wait a bit
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const recent = activityRepo.getRecent(1);
        assert.equal(recent.length, 1);
        assert.equal(recent[0].module, 'test_module');
        assert.ok(recent[0].details.includes(testMessage));
    });

    await t.test('should log error messages to sqlite', async () => {
        activityRepo.clear();
        const errorMessage = `Test error message ${Date.now()}`;
        
        logger.error(errorMessage, { module: 'error_module', error: 'test_error' });
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const recent = activityRepo.getRecent(1);
        assert.equal(recent.length, 1);
        assert.equal(recent[0].module, 'error_module');
        assert.ok(recent[0].details.includes(errorMessage));
        assert.ok(recent[0].details.includes('test_error'));
    });
});
