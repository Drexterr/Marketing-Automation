import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RuntimeStateRepository } from './RuntimeStateRepository.js';

test('RuntimeStateRepository', async (t) => {
    const repo = new RuntimeStateRepository();

    await t.test('should set and get a value', () => {
        repo.clear();
        repo.set('test_key', { foo: 'bar' });
        const value = repo.get('test_key');
        assert.deepEqual(value, { foo: 'bar' });
    });

    await t.test('should return null for non-existent key', () => {
        repo.clear();
        const value = repo.get('non_existent');
        assert.equal(value, null);
    });

    await t.test('should update existing key', () => {
        repo.clear();
        repo.set('update_me', 1);
        repo.set('update_me', 2);
        assert.equal(repo.get('update_me'), 2);
    });
});
