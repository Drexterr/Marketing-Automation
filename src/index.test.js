import assert from 'node:assert';
import { describe, it } from 'node:test';
import { validateConfig } from './index.js';

describe('Configuration Validation', () => {
  it('throws an error if CLAUDE_MODE is missing', () => {
    const originalEnv = process.env.CLAUDE_MODE;
    delete process.env.CLAUDE_MODE;
    assert.throws(() => validateConfig(), /Missing required environment variables: CLAUDE_MODE/);
    process.env.CLAUDE_MODE = originalEnv;
  });
});
