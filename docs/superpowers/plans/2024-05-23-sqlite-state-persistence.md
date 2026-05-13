# SQLite State Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor system state management to use SQLite as the single source of truth, deprecating in-memory state in `StateManager.js` and unifying it with `RuntimeStateService`.

**Architecture:** Use `RuntimeStateRepository` as the central point for state persistence. `StateManager` will become a wrapper around this repository. `RuntimeStateService` and `helpers.js` will interact with the same underlying SQLite table, ensuring consistency across the entire application.

**Tech Stack:** Node.js, SQLite (via `better-sqlite3`), `node:test` for testing.

---

### Task 1: Research and Baseline Tests

**Files:**
- Create: `shared/state/StateManager.persistence.test.js`
- Create: `src/utils/helpers.state.test.js`

- [ ] **Step 1: Create persistence test for StateManager**
Create a test that verifies that two different instances of `StateManager` share the same state via SQLite.

```javascript
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
```

- [ ] **Step 2: Run test and verify failure**
Run: `node --test shared/state/StateManager.persistence.test.js`
Expected: FAIL (because it's currently in-memory)

- [ ] **Step 3: Create state tests for helpers.js**
Create tests for `getSystemState` and `updateSystemState`.

```javascript
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
```

- [ ] **Step 4: Run test and verify current state**
Run: `node --test src/utils/helpers.state.test.js`
Expected: Might PASS because it already uses `RuntimeStateService`, but good to have a baseline.

---

### Task 2: Refactor StateManager.js

**Files:**
- Modify: `shared/state/StateManager.js`

- [ ] **Step 1: Update StateManager to use RuntimeStateRepository**

```javascript
import { RuntimeStateRepository } from '../repositories/RuntimeStateRepository.js';

export class StateManager {
  constructor() {
    this.repo = new RuntimeStateRepository();
    
    // Initialize default state if not present
    if (this.repo.get('scheduler') === null) {
      this.repo.set('scheduler', 'idle');
    }
    if (this.repo.get('metrics') === null) {
      this.repo.set('metrics', {});
    }
  }

  getState(key) {
    return this.repo.get(key);
  }

  setState(key, value) {
    this.repo.set(key, value);
  }

  updateState(key, value) {
    const current = this.repo.get(key);
    if (typeof value === 'object' && !Array.isArray(value) && typeof current === 'object' && current !== null) {
      this.repo.set(key, { ...current, ...value });
    } else {
      this.repo.set(key, value);
    }
  }
}

export const stateManager = new StateManager();
```

- [ ] **Step 2: Run baseline tests**
Run: `node --test shared/state/StateManager.test.js`
Expected: PASS

- [ ] **Step 3: Run persistence tests**
Run: `node --test shared/state/StateManager.persistence.test.js`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add shared/state/StateManager.js shared/state/StateManager.persistence.test.js
git commit -m "refactor: StateManager now uses SQLite persistence"
```

---

### Task 3: Refactor helpers.js

**Files:**
- Modify: `src/utils/helpers.js`

- [ ] **Step 1: Simplify getSystemState and updateSystemState**
Ensure they are clean and rely purely on `RuntimeStateService` (which uses the same repo).

```javascript
export async function getSystemState() {
  const state = RuntimeStateService.getFlag('system_state') || {};
  
  if (!state.firstRunDate) {
    state.firstRunDate = new Date().toISOString();
  }
  
  // Recalculate dynamic fields
  const firstRun = new Date(state.firstRunDate);
  const now = new Date();
  const diffDays = Math.floor((now - firstRun) / (1000 * 60 * 60 * 24));
  state.currentWeek = Math.floor(diffDays / 7) + 1;

  // Add operational visibility
  try {
    const lastRun = schedulerRunsRepo.db.prepare(`SELECT * FROM scheduler_runs WHERE status = 'completed' ORDER BY start_time DESC LIMIT 1`).get();
    if (lastRun) state.lastSuccessfulRun = lastRun.start_time;

    const lastFailed = schedulerRunsRepo.db.prepare(`SELECT * FROM scheduler_runs WHERE status = 'failed' ORDER BY start_time DESC LIMIT 1`).get();
    if (lastFailed) state.lastFailureReason = lastFailed.failure_reason;
  } catch (e) {}

  state.emergencyStop = RuntimeStateService.getFlag('emergency_stop');
  const pulse = RuntimeStateService.getPulse();
  state.currentTask = pulse.activeTask;
  
  try {
    const pendingReviews = reviewQueueRepo.db.prepare(`SELECT COUNT(*) as count FROM review_queue WHERE status = 'pending'`).get().count;
    state.pendingReviewQueueCount = pendingReviews;
  } catch (e) {}

  return state;
}

export async function updateSystemState(updates) {
  const currentState = await getSystemState();
  const newState = { ...currentState, ...updates };
  
  // Ensure we don't persist calculated/dynamic visibility fields that are added by getSystemState
  const { lastSuccessfulRun, lastFailureReason, emergencyStop, currentTask, pendingReviewQueueCount, currentWeek, ...persistable } = newState;

  RuntimeStateService.setFlag('system_state', persistable);
  return await getSystemState(); // Return full state including dynamic fields
}
```

- [ ] **Step 2: Run state tests**
Run: `node --test src/utils/helpers.state.test.js`
Expected: PASS

- [ ] **Step 3: Run existing helper tests**
Run: `node --test src/utils/helpers.test.js`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/utils/helpers.js src/utils/helpers.state.test.js
git commit -m "refactor: helpers use unified SQLite state"
```

---

### Task 4: Final Verification and Cleanup

- [ ] **Step 1: Run all related tests**
Run:
`node --test shared/state/StateManager.test.js`
`node --test shared/state/StateManager.persistence.test.js`
`node --test backend-api/services/RuntimeStateService.test.js`
`node --test src/utils/helpers.test.js`
`node --test src/utils/helpers.state.test.js`

- [ ] **Step 2: Check for any other state usage**
Grep for `new StateManager` or `stateManager` imports to ensure no regressions.

- [ ] **Step 3: Final Commit**
```bash
git commit -m "chore: state management refactor completion"
```
