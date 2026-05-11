import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { randomDelay, updateConnectionRecord } from './helpers.js';
import { ConnectionRepository } from '../../shared/repositories/ConnectionRepository.js';

describe('helpers.js', () => {
  const repo = new ConnectionRepository();

  describe('randomDelay', () => {
    it('should be a function', () => {
      assert.strictEqual(typeof randomDelay, 'function');
    });

    it('should return a promise', () => {
      const result = randomDelay(1, 2);
      assert.ok(result instanceof Promise);
    });
  });

  describe('updateConnectionRecord', () => {
    it('should update connection record correctly', async () => {
      repo.clear();
      const url = 'https://example.com/profile';
      
      // Initial upsert via helper
      await updateConnectionRecord(null, url, { 
        status: 'sent', 
        lastAction: 'connect', 
        name: 'Test User' 
      });

      let record = repo.findByProfileUrl(url);
      assert.strictEqual(record.status, 'sent');
      assert.strictEqual(record.last_action, 'connect');
      assert.strictEqual(JSON.parse(record.data).name, 'Test User');

      // Update status only
      await updateConnectionRecord(null, url, { status: 'accepted' });
      record = repo.findByProfileUrl(url);
      assert.strictEqual(record.status, 'accepted');
      assert.strictEqual(record.last_action, 'connect'); // Should be preserved
      assert.strictEqual(JSON.parse(record.data).name, 'Test User'); // Should be preserved

      // Update data only
      await updateConnectionRecord(null, url, { note: 'Some note' });
      record = repo.findByProfileUrl(url);
      assert.strictEqual(record.status, 'accepted'); // Should be preserved
      assert.strictEqual(record.last_action, 'connect'); // Should be preserved
      const data = JSON.parse(record.data);
      assert.strictEqual(data.name, 'Test User');
      assert.strictEqual(data.note, 'Some note');
    });
  });
});
