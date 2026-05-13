import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StateManager } from './StateManager.js';
import { RuntimeStateRepository } from '../repositories/RuntimeStateRepository.js';

test('StateManager persists across instances', () => {
  const repo = new RuntimeStateRepository();
  repo.db.prepare('DELETE FROM runtime_state').run(); // Clean start
  
  const sm1 = new StateManager();
  sm1.setState('test_key', 'value1');
  
  const sm2 = new StateManager();
  assert.equal(sm2.getState('test_key'), 'value1');
});
