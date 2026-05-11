import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReviewQueueRepository } from './ReviewQueueRepository.js';

test('ReviewQueueRepository', async (t) => {
    const repo = new ReviewQueueRepository();

    await t.test('should get pending items', () => {
        repo.clear();
        repo.create({ type: 'message', status: 'pending', data: '{}' });
        repo.create({ type: 'post', status: 'approved', data: '{}' });
        
        const pending = repo.getPending();
        assert.equal(pending.length, 1);
        assert.equal(pending[0].type, 'message');
    });

    await t.test('should update status and response', () => {
        repo.clear();
        const item = repo.create({ type: 'message', status: 'pending', data: '{}' });
        
        repo.updateStatus(item.id, 'approved', 'Hello world');
        const updated = repo.findById(item.id);
        
        assert.equal(updated.status, 'approved');
        assert.equal(updated.response, 'Hello world');
    });
});
