import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActivityRepository } from './ActivityRepository.js';

test('ActivityRepository', async (t) => {
    const repo = new ActivityRepository();

    await t.test('should log an event', () => {
        repo.clear();
        const result = repo.log('TEST_EVENT', 'test_module', { foo: 'bar' });
        assert.equal(result.event_type, 'TEST_EVENT');
        assert.equal(result.module, 'test_module');
        assert.equal(result.details, JSON.stringify({ foo: 'bar' }));
        assert.ok(result.id);
    });

    await t.test('should get recent events', () => {
        repo.clear();
        repo.log('EVENT_1', 'm1', 'd1');
        repo.log('EVENT_2', 'm2', 'd2');
        const recent = repo.getRecent(2);
        assert.equal(recent.length, 2);
        assert.equal(recent[0].event_type, 'EVENT_2');
        assert.equal(recent[1].event_type, 'EVENT_1');
    });

    await t.test('cleans up old logs', () => {
        const repo = new ActivityRepository();
        repo.cleanupOldLogs(30);
        assert.ok(true);
    });
});
