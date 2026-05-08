import { describe, it } from 'node:test';
import assert from 'node:assert';
import { randomDelay } from './helpers.js';

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
});
