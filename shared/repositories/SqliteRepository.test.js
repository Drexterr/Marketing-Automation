import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SqliteRepository } from './SqliteRepository.js';
import db from '../../backend-api/db/init.js';

test('SqliteRepository CRUD operations', async (t) => {
    const tableName = 'test_table';
    
    // Create a temporary table for testing
    db.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    const repo = new SqliteRepository(tableName);

    await t.test('should create a record', () => {
        repo.clear();
        const data = { name: 'test', value: '123' };
        const result = repo.create(data);
        assert.equal(result.name, 'test');
        assert.equal(result.value, '123');
        assert.ok(result.id);
    });

    await t.test('should find a record by id', () => {
        repo.clear();
        const data = { name: 'find_me', value: '456' };
        const created = repo.create(data);
        const found = repo.findById(created.id);
        assert.equal(found.name, 'find_me');
        assert.equal(found.id, created.id);
    });

    await t.test('should find all records', () => {
        repo.clear();
        repo.create({ name: 'a', value: '1' });
        repo.create({ name: 'b', value: '2' });
        const all = repo.findAll();
        assert.equal(all.length, 2);
    });

    await t.test('should update a record', () => {
        repo.clear();
        const created = repo.create({ name: 'old', value: 'old' });
        const updated = repo.update(created.id, { name: 'new' });
        assert.equal(updated.name, 'new');
        assert.equal(updated.value, 'old'); // should remain same
    });

    // Cleanup
    db.exec(`DROP TABLE ${tableName}`);
});
