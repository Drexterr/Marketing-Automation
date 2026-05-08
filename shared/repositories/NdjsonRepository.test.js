import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NdjsonRepository } from './NdjsonRepository.js';
import fs from 'fs';
import path from 'path';

test('NdjsonRepository appends and reads NDJSON logs', async () => {
  const testFile = path.join('data', 'test-activity.ndjson');
  if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  
  const repo = new NdjsonRepository(testFile);
  
  await repo.create({ id: 1, action: 'connect' });
  await repo.create({ id: 2, action: 'message' });

  const items = await repo.findAll();
  assert.equal(items.length, 2);
  assert.equal(items[1].action, 'message');

  fs.unlinkSync(testFile);
});
