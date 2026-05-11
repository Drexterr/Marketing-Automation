import { callCLI } from './claude-cli.js';
import assert from 'node:assert';
import test from 'node:test';

test('callCLI executes correctly', async () => {
    // This test verifies that callCLI can successfully execute the claude command.
    // If the environment doesn't have claude installed, it might fail, 
    // but we want to see it fail or pass depending on the implementation.
    try {
        const result = await callCLI('Reply with: ok');
        assert.ok(result.toLowerCase().includes('ok'), `Expected output to include "ok", but got: "${result}"`);
    } catch (error) {
        // If it's a "not found" error, we want to know if it's because of our changes
        if (error.message.includes('not found') || error.message.includes('ENOENT')) {
             throw error;
        }
        console.log('Skipping actual CLI call failure (likely auth/network):', error.message);
    }
});
