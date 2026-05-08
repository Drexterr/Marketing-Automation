import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JsonRepository } from './JsonRepository.js';
import fs from 'fs';
import path from 'path';

test('JsonRepository reads and writes JSON', async () => {
  const testFile = path.join('data', 'test-config.json');
  // Ensure clean state
  if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  if (!fs.existsSync('data')) fs.mkdirSync('data', { recursive: true });

  const repo = new JsonRepository(testFile);
  
  // Read non-existent
  const initial = await repo.findAll();
  assert.deepEqual(initial, {});

  // Create/Update
  await repo.update({ connect_enabled: true });
  const updated = await repo.findAll();
  assert.equal(updated.connect_enabled, true);

  // Cleanup
  fs.unlinkSync(testFile);
});
