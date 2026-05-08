import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StateManager } from './StateManager.js';

test('StateManager stores and retrieves state', () => {
  const stateManager = new StateManager();
  
  assert.equal(stateManager.getState('scheduler'), 'idle');
  
  stateManager.setState('scheduler', 'running');
  assert.equal(stateManager.getState('scheduler'), 'running');
});

test('StateManager handles partial updates', () => {
  const stateManager = new StateManager();
  stateManager.updateState('metrics', { processed: 5 });
  stateManager.updateState('metrics', { failed: 1 });
  
  assert.deepEqual(stateManager.getState('metrics'), { processed: 5, failed: 1 });
});
