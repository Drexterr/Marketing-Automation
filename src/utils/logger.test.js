import { logger } from './logger.js';
import fs from 'fs';
import path from 'path';
import assert from 'node:assert';
import { test, before } from 'node:test';

const logDir = path.resolve(process.cwd(), 'logs');

test('logger has specialized streams', () => {
  assert.strictEqual(typeof logger.security, 'function', 'logger.security should be a function');
  assert.strictEqual(typeof logger.ai, 'function', 'logger.ai should be a function');
});

test('logger creates log files', (t, done) => {
  logger.info('Test automation log');
  logger.error('Test error log');
  logger.ai('Test AI log');
  logger.security('Test Security log');

  // Winston file logging is async, wait for it to flush
  setTimeout(() => {
    const files = fs.readdirSync(logDir);
    console.log('Files in logDir:', files);
    assert(files.some(f => f.startsWith('automation-')), 'automation log file should exist');
    assert(files.some(f => f.startsWith('errors-')), 'errors log file should exist');
    assert(files.some(f => f.startsWith('ai-')), 'ai log file should exist');
    assert(files.some(f => f.startsWith('security-')), 'security log file should exist');
    done();
  }, 1000);
});
