import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { randomDelay, updateConnectionRecord, withTimeout } from './helpers.js';
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

  describe('withTimeout', () => {
    it('should resolve if promise resolves before timeout', async () => {
      const result = await withTimeout(Promise.resolve('success'), 100, 'test');
      assert.strictEqual(result, 'success');
    });

    it('should reject if promise takes longer than timeout', async () => {
      const slowPromise = new Promise(resolve => setTimeout(() => resolve('slow'), 200));
      await assert.rejects(
        withTimeout(slowPromise, 100, 'test'),
        { message: 'Timeout exceeded: test took longer than 100ms' }
      );
    });

    it('should support AbortController if provided', async () => {
      const controller = new AbortController();
      const task = (signal) => new Promise((resolve, reject) => {
        const timeout = setTimeout(() => resolve('done'), 200);
        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new Error('Aborted'));
        });
      });

      const promise = withTimeout(task(controller.signal), 100, 'aborted-task', controller);
      try {
        await promise;
        assert.fail('Should have rejected');
      } catch (err) {
        assert.ok(err.message.includes('Aborted') || err.message.includes('Timeout exceeded'), `Unexpected error message: ${err.message}`);
      }
      assert.strictEqual(controller.signal.aborted, true);
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
