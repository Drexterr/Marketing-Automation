import { describe, it } from 'node:test';
import assert from 'node:assert';
import { randomDelay, withTimeout } from './helpers.js';

describe('helpers.js', () => {
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
});
