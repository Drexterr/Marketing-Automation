# Architectural Cleanup & Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up architectural inconsistencies by implementing a unified state machine, a proper node-cron scheduler, and improved operational UX without rewriting the whole system.

**Architecture:** We are refactoring existing services (`RuntimeStateService`, `scheduler.js`, `claude-service.js`) and adding targeted UI improvements to the existing dashboard components. SQLite remains the primary datastore.

**Tech Stack:** Node.js, Express, node-cron, SQLite, React, Tailwind CSS

---

### Task 1: Configuration Validation

**Files:**
- Modify: `src/index.js`
- Test: `src/index.test.js`

- [ ] **Step 1: Write the failing test for configuration validation**

```javascript
// src/index.test.js
import assert from 'assert';
import { validateConfig } from './index.js';

describe('Configuration Validation', () => {
  it('throws an error if CLAUDE_MODE is missing', () => {
    const originalEnv = process.env.CLAUDE_MODE;
    delete process.env.CLAUDE_MODE;
    assert.throws(() => validateConfig(), /CLAUDE_MODE is required/);
    process.env.CLAUDE_MODE = originalEnv;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/index.test.js`
Expected: FAIL with "validateConfig is not defined" or similar.

- [ ] **Step 3: Write minimal implementation**

```javascript
// Add to src/index.js
export function validateConfig() {
  const requiredVars = ['CLAUDE_MODE', 'FOUNDER_NAME', 'PRODUCT_NAME'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    throw new Error(`Configuration Error: Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Call it at the top of the startup sequence
validateConfig();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/index.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/index.js src/index.test.js
git commit -m "feat: add startup configuration validation"
```

### Task 2: Unified State Machine

**Files:**
- Modify: `backend-api/services/RuntimeStateService.js`
- Test: `backend-api/services/RuntimeStateService.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// backend-api/services/RuntimeStateService.test.js
import assert from 'assert';
import { RuntimeStateService } from './RuntimeStateService.js';

describe('Unified State Machine', () => {
  it('prevents invalid state transitions', () => {
    RuntimeStateService.setWorkflowState('RUNNING');
    assert.throws(() => RuntimeStateService.setWorkflowState('IDLE'), /Invalid transition/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- backend-api/services/RuntimeStateService.test.js`
Expected: FAIL with "setWorkflowState is not a function"

- [ ] **Step 3: Write minimal implementation**

```javascript
// Add to backend-api/services/RuntimeStateService.js
const VALID_TRANSITIONS = {
  'IDLE': ['RUNNING'],
  'RUNNING': ['PAUSED', 'ERROR', 'IDLE'],
  'PAUSED': ['RUNNING', 'IDLE'],
  'ERROR': ['IDLE']
};

export const RuntimeStateService = {
  // ... existing code ...
  
  setWorkflowState: (newState) => {
    const currentState = repo.get('workflow_state') || 'IDLE';
    
    // Check transitions unless it's the initial set
    if (currentState && VALID_TRANSITIONS[currentState] && !VALID_TRANSITIONS[currentState].includes(newState)) {
        if (newState !== 'ERROR') {
            throw new Error(`Invalid transition from ${currentState} to ${newState}`);
        }
    }
    
    repo.set('workflow_state', newState);
  },
  
  getWorkflowState: () => repo.get('workflow_state') || 'IDLE',
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- backend-api/services/RuntimeStateService.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend-api/services/RuntimeStateService.js backend-api/services/RuntimeStateService.test.js
git commit -m "feat: implement unified state machine transitions"
```

### Task 3: Scheduler Refactor

**Files:**
- Modify: `src/scheduler.js`
- Test: `src/scheduler.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// src/scheduler.test.js
import assert from 'assert';
import { runScheduler } from './scheduler.js';

describe('Scheduler Refactor', () => {
  it('does not contain while-loop interruptibleSleep', () => {
    assert.strictEqual(runScheduler.toString().includes('interruptibleSleep'), false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/scheduler.test.js`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/scheduler.js
export async function runScheduler(tasks) {
  if (!acquireLock()) process.exit(1);
  process.on('exit', releaseLock);
  process.on('SIGINT', () => { releaseLock(); process.exit(); });
  process.on('SIGTERM', () => { releaseLock(); process.exit(); });

  await performCrashRecovery();

  logger.info('Scheduler: Initialized independent cron jobs.');
  RuntimeStateService.setWorkflowState('IDLE');

  tasks.forEach((task, index) => {
    const minuteOffset = (index * 5) % 60;
    cron.schedule(`${minuteOffset} * * * *`, async () => {
      if (RuntimeStateService.getFlag('emergency_stop')) return;
      if (RuntimeStateService.getWorkflowState() === 'RUNNING') {
          logger.info(`Skipping ${task.name} - another task is running.`);
          return;
      }
      
      RuntimeStateService.setWorkflowState('RUNNING');
      try {
         await task();
      } finally {
         RuntimeStateService.setWorkflowState('IDLE');
      }
    });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/scheduler.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scheduler.js src/scheduler.test.js
git commit -m "refactor: replace blocking scheduler loop with modular cron jobs"
```

### Task 4: Logging & Retention

**Files:**
- Modify: `shared/repositories/ActivityRepository.js`
- Modify: `src/scheduler.js`

- [ ] **Step 1: Write the failing test**

```javascript
// shared/repositories/ActivityRepository.test.js
import assert from 'assert';
import { ActivityRepository } from './ActivityRepository.js';

describe('ActivityRepository', () => {
  it('cleans up old logs', () => {
    const repo = new ActivityRepository();
    repo.cleanupOldLogs(30);
    // basic pass if it does not throw
    assert.ok(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- shared/repositories/ActivityRepository.test.js`
Expected: FAIL with "cleanupOldLogs is not a function"

- [ ] **Step 3: Write minimal implementation**

```javascript
// Add to shared/repositories/ActivityRepository.js
cleanupOldLogs(days) {
  this.db.prepare(`DELETE FROM activity_logs WHERE timestamp < datetime('now', '-' || ? || ' days')`).run(days);
}

// Add to src/scheduler.js in performCrashRecovery or startup
const activityRepo = new ActivityRepository();
activityRepo.cleanupOldLogs(30);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- shared/repositories/ActivityRepository.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/repositories/ActivityRepository.js src/scheduler.js
git commit -m "feat: implement log retention policy for sqlite"
```

### Task 5: Review Queue Workflow

**Files:**
- Modify: `shared/repositories/ReviewQueueRepository.js`

- [ ] **Step 1: Write the failing test**

```javascript
// shared/repositories/ReviewQueueRepository.test.js
import assert from 'assert';
import { ReviewQueueRepository } from './ReviewQueueRepository.js';

describe('ReviewQueue Workflow', () => {
  it('requires operatorNotes when resolving', () => {
    const repo = new ReviewQueueRepository();
    assert.throws(() => repo.resolve('some_id', null, 'response'), /operatorNotes required/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- shared/repositories/ReviewQueueRepository.test.js`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```javascript
// shared/repositories/ReviewQueueRepository.js
resolve(id, operatorNotes, response) {
  if (!operatorNotes) {
    throw new Error('operatorNotes required for resolution');
  }
  this.db.prepare(`UPDATE review_queue SET status = 'resolved', operator_notes = ?, response = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?`).run(operatorNotes, response, id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- shared/repositories/ReviewQueueRepository.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/repositories/ReviewQueueRepository.js
git commit -m "feat: enforce review queue workflow state"
```

### Task 6: Claude Failure Visibility

**Files:**
- Modify: `src/claude-service.js`
- Modify: `backend-api/server.js`

- [ ] **Step 1: Write the failing test**

```javascript
// src/claude-service.test.js
import assert from 'assert';
import { testClaudeConnection } from './claude-service.js';

describe('Claude Service Visibility', () => {
  it('exposes testClaudeConnection function', async () => {
    assert.strictEqual(typeof testClaudeConnection, 'function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/claude-service.test.js`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/claude-service.js
export async function testClaudeConnection() {
  try {
    await callClaude('Test prompt for health check. Reply OK.');
    return { status: 'HEALTHY' };
  } catch (e) {
    return { status: 'ERROR', error: e.message };
  }
}

// Add to backend-api/server.js
import { testClaudeConnection } from '../src/claude-service.js';
// on start
testClaudeConnection().then(res => console.log('Claude Health:', res));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/claude-service.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/claude-service.js backend-api/server.js
git commit -m "feat: add startup health check for claude"
```

### Task 7: Dashboard Operational UX

**Files:**
- Modify: `frontend/components/dashboard/PulseHeader.tsx`

- [ ] **Step 1: Write minimal implementation**

```tsx
// frontend/components/dashboard/PulseHeader.tsx
import { useSystemState } from '@/lib/api';

export function PulseHeader() {
  const { data } = useSystemState();
  
  return (
    <div className="flex items-center justify-between p-4 bg-white shadow rounded">
       <div>
         <h1 className="text-xl font-bold">System Pulse</h1>
         <p className="text-sm text-gray-500">
           State: {data?.workflow_state || 'UNKNOWN'}
         </p>
         {data?.lastRun && (
           <p className="text-xs text-gray-400">Last Run: {new Date(data.lastRun).toLocaleString()}</p>
         )}
       </div>
       {data?.pulse?.status === 'ERROR' && (
         <div className="bg-red-100 text-red-700 p-2 rounded">System Degraded</div>
       )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/dashboard/PulseHeader.tsx
git commit -m "feat: add operational metrics and failure banner to Dashboard"
```