import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testClaudeConnection } from './claude-service.js';

test('Claude Service Visibility', async () => {
    assert.strictEqual(typeof testClaudeConnection, 'function');
});
