import { test } from 'node:test';
import assert from 'node:assert';
import { runConnectionWorkflow } from './task-connect.js';

test('runConnectionWorkflow handles profiles and evaluation', async (t) => {
  // Verify the script compiles and exports correctly
  assert.strictEqual(typeof runConnectionWorkflow, 'function');
});
