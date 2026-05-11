import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PromptRepository } from './PromptRepository.js';
import db from '../../backend-api/db/init.js';

test('PromptRepository', async (t) => {
    const repo = new PromptRepository();

    const cleanup = () => {
        db.prepare('DELETE FROM prompt_versions').run();
    };

    await t.test('saveVersion should increment version and save content', () => {
        cleanup();
        repo.saveVersion('test-key', 'content v1');
        const v1 = repo.getLatest('test-key');
        assert.equal(v1.version, 1);
        assert.equal(v1.content, 'content v1');

        repo.saveVersion('test-key', 'content v2');
        const v2 = repo.getLatest('test-key');
        assert.equal(v2.version, 2);
        assert.equal(v2.content, 'content v2');
    });

    await t.test('getHistory should return all versions newest first', () => {
        cleanup();
        repo.saveVersion('test-key', 'v1');
        repo.saveVersion('test-key', 'v2');
        const history = repo.getHistory('test-key');
        assert.equal(history.length, 2);
        assert.equal(history[0].version, 2);
        assert.equal(history[1].version, 1);
    });

    await t.test('rollback should create a new version with old content', () => {
        cleanup();
        repo.saveVersion('test-key', 'v1');
        repo.saveVersion('test-key', 'v2');
        const v1 = repo.getHistory('test-key')[1];
        
        repo.rollback('test-key', v1.id);
        const latest = repo.getLatest('test-key');
        assert.equal(latest.version, 3);
        assert.equal(latest.content, 'v1');
    });

    await t.test('getAllLatest should return latest version of all keys', () => {
        cleanup();
        repo.saveVersion('key1', 'k1v1');
        repo.saveVersion('key1', 'k1v2');
        repo.saveVersion('key2', 'k2v1');
        
        const latest = repo.getAllLatest();
        assert.equal(latest.length, 2);
        
        const k1 = latest.find(p => p.key === 'key1');
        const k2 = latest.find(p => p.key === 'key2');
        
        assert.equal(k1.version, 2);
        assert.equal(k1.content, 'k1v2');
        assert.equal(k2.version, 1);
        assert.equal(k2.content, 'k2v1');
    });
});
