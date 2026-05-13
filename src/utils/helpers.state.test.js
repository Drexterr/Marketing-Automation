import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getSystemState, updateSystemState } from './helpers.js';
import { RuntimeStateRepository } from '../../shared/repositories/RuntimeStateRepository.js';

const repo = new RuntimeStateRepository();

test('helpers state management', async (t) => {
  repo.db.prepare('DELETE FROM runtime_state').run();

  await t.test('getSystemState returns default structure', async () => {
    const state = await getSystemState();
    assert.ok(state.firstRunDate);
    assert.equal(state.currentWeek, 1);
  });

  await t.test('updateSystemState merges updates', async () => {
    await updateSystemState({ custom: 'value' });
    const state = await getSystemState();
    assert.equal(state.custom, 'value');
    assert.ok(state.firstRunDate);
  });
});
