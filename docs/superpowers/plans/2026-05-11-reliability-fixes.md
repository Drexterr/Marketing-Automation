# Reliability Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the scheduler into a safe, robust, and idempotent system for long-running operations.

**Architecture:** We will implement `EmergencyStopError` for safe cancellation, native DB `ON CONFLICT` atomic upserts, debounced state writes, and explicit crash-recovery transitions on startup.

**Tech Stack:** Node.js, SQLite, Playwright

---

### Task 1: Interruptible Delays & Mid-Loop Checks

**Files:**
- Modify: `src/utils/helpers.js`
- Modify: `src/task-connect.js`
- Modify: `src/task-feed.js`

- [ ] **Step 1: Define `EmergencyStopError` in `helpers.js`**
Modify `src/utils/helpers.js` to export a custom error class for safe interruption.
```javascript
export class EmergencyStopError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EmergencyStopError';
  }
}
```

- [ ] **Step 2: Inject safe checks into utilities in `helpers.js`**
Update `humanType`, `randomDelay` to throw `EmergencyStopError`.
```javascript
export async function humanType(element, text) {
  for (const char of text) {
    if (RuntimeStateService.getFlag('emergency_stop')) throw new EmergencyStopError('Emergency stop interrupted typing');
    await element.type(char);
    await new Promise(r => setTimeout(r, randomBetween(30, 130)));
  }
}

export const randomDelay = async (min = 8000, max = 25000) => {
  const target = randomBetween(min, max);
  const start = Date.now();
  while (Date.now() - start < target) {
    if (RuntimeStateService.getFlag('emergency_stop')) throw new EmergencyStopError('Emergency stop interrupted delay');
    await new Promise(r => setTimeout(r, Math.min(1000, target - (Date.now() - start))));
  }
};
```

- [ ] **Step 3: Handle `EmergencyStopError` in `task-connect.js`**
Update the catch block in `runConnectionWorkflow` to rethrow or break cleanly on `EmergencyStopError`.
```javascript
      } catch (error) {
        if (error instanceof EmergencyStopError || error.message.includes('EmergencyStopError')) {
          logger.info('Connect task aborted gracefully due to emergency stop.');
          break; // Stop processing further profiles
        }
        logger.error(`Error processing profile ${profile.name}`, { error: error.message });
        failed++;
      }
```

- [ ] **Step 4: Handle `EmergencyStopError` in `task-feed.js`**
Update the catch block in `runFeedCommenting` to handle `EmergencyStopError`.
```javascript
        } catch (err) {
          if (err instanceof EmergencyStopError || err.message.includes('EmergencyStopError')) {
            logger.info('Feed task aborted gracefully due to emergency stop.');
            return;
          }
          logger.error(`Failed to comment on post ${urn}`, { message: err.message });
        }
```

- [ ] **Step 5: Commit Task 1**
```bash
git add src/utils/helpers.js src/task-connect.js src/task-feed.js
git commit -m "feat: implement interruptible delays and mid-loop safety checks"
```

### Task 2: Atomic Upsert & Concurrency Safety

**Files:**
- Modify: `shared/repositories/ConnectionRepository.js`
- Modify: `src/utils/helpers.js`

- [ ] **Step 1: Fix `ConnectionRepository.upsert` to avoid nulling existing columns**
Modify `shared/repositories/ConnectionRepository.js` to use `COALESCE` in the `ON CONFLICT` clause.
```javascript
    upsert(profileUrl, status, lastAction, data) {
        const now = new Date().toISOString();
        const dataStr = JSON.stringify(data || {});

        this.db.prepare(`
            INSERT INTO connections (profile_url, status, last_action, data, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(profile_url) DO UPDATE SET
                status = COALESCE(excluded.status, connections.status),
                last_action = COALESCE(excluded.last_action, connections.last_action),
                data = json_patch(connections.data, excluded.data),
                updated_at = excluded.updated_at
        `).run(profileUrl, status, lastAction, dataStr, now, now);

        return this.findByProfileUrl(profileUrl);
    }
```

- [ ] **Step 2: Simplify `updateConnectionRecord` in `helpers.js`**
Remove the read-then-write pattern and directly call the atomic upsert.
```javascript
export async function updateConnectionRecord(filePath, url, updates) {
  const status = updates.status || null;
  const lastAction = updates.lastAction || null;
  
  const newData = { ...updates };
  delete newData.status;
  delete newData.lastAction;
  delete newData.url;

  connectionRepo.upsert(url, status, lastAction, newData);
}
```

- [ ] **Step 3: Commit Task 2**
```bash
git add shared/repositories/ConnectionRepository.js src/utils/helpers.js
git commit -m "fix: implement atomic sqlite upserts for concurrency safety"
```

### Task 3: Runtime State Optimization

**Files:**
- Modify: `backend-api/services/RuntimeStateService.js`

- [ ] **Step 1: Implement debounced pulse writes**
Modify `setPulse` to debounce intermediate updates, but immediately flush on status changes or bounds.
```javascript
let pulseTimeout = null;

export const RuntimeStateService = {
    // ... existing methods
    setPulse: (data) => {
        const now = Date.now();
        const isBoundary = data.progressPercent === 100 || data.progressPercent === 0;
        const currentPulse = repo.get('runtime_pulse') || {};
        const isStatusChange = data.status !== currentPulse.status;

        const writePulse = () => {
            const pulse = {
                ...data,
                lastHeartbeat: new Date().toISOString()
            };
            repo.set('runtime_pulse', pulse);
            lastPulseTime = Date.now();
        };

        if (isBoundary || isStatusChange || now - lastPulseTime > THROTTLE_MS) {
            if (pulseTimeout) clearTimeout(pulseTimeout);
            writePulse();
        } else {
            if (pulseTimeout) clearTimeout(pulseTimeout);
            pulseTimeout = setTimeout(writePulse, THROTTLE_MS);
        }
    },
    // ...
```

- [ ] **Step 2: Commit Task 3**
```bash
git add backend-api/services/RuntimeStateService.js
git commit -m "perf: optimize runtime state pulse with debouncing"
```

### Task 4: Scheduler Run History & Task Timeouts

**Files:**
- Modify: `src/scheduler.js`
- Modify: `src/task-connect.js`
- Modify: `src/task-feed.js`
- Modify: `src/utils/helpers.js`

- [ ] **Step 1: Add AbortController support to `withTimeout` in `helpers.js`**
Update `withTimeout` to support `AbortController` if the inner promise accepts one, or simply ensure standard timeout functionality doesn't leak memory.
```javascript
export function withTimeout(promise, ms, operationName) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout exceeded: ${operationName} took longer than ${ms}ms`));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}
```
*(Note: The existing `withTimeout` is already implemented. We ensure tasks return `recordsProcessed` below to track history.)*

- [ ] **Step 2: Make `runConnectionWorkflow` return counts**
In `src/task-connect.js`, return the processed counts at the end of the function.
```javascript
  await logSessionSummary({
    runType: "connections",
    connectionsSent,
    failed,
    dailyLimitHit,
    weeklyLimitRemaining: Math.max(0, weeklyLimit - sentInLastWeek)
  });

  return { recordsProcessed: connectionsSent };
}
```

- [ ] **Step 3: Make `runFeedCommenting` return counts**
In `src/task-feed.js`, return the processed counts.
```javascript
    if (scrollAttempts >= MAX_SCROLL_ATTEMPTS) {
      logger.warn('Feed exhausted — exiting early');
    }
    
    return { recordsProcessed: commentsSent };

  } catch (error) {
    logger.error('Feed commenting workflow failed', { message: error.message });
    return { recordsProcessed: 0, error: error.message };
  } finally {
```

- [ ] **Step 4: Update `scheduler.js` to log history correctly**
Update the task loop in `runScheduler` to capture records processed.
```javascript
      let totalRecords = 0;

      for (const task of tasks) {
        // ... inside loop
        try {
          // 15-minute timeout per major task
          const result = await withTimeout(task(), 15 * 60 * 1000, task.name || 'Anonymous Task');
          if (result && result.recordsProcessed) {
            totalRecords += result.recordsProcessed;
            runsRepo.update(currentRunId, { records_processed: totalRecords });
          }
        } catch (error) {
```

- [ ] **Step 5: Commit Task 4**
```bash
git add src/utils/helpers.js src/task-connect.js src/task-feed.js src/scheduler.js
git commit -m "feat: implement scheduler run history and track records processed"
```

### Task 5: Crash Recovery

**Files:**
- Modify: `src/scheduler.js`

- [ ] **Step 1: Implement orphaned connection recovery on startup**
In `src/scheduler.js`, right before starting the loop, fail any orphaned connections.
```javascript
  // CRASH RECOVERY: Mark incomplete runs as failed
  try {
    const incompleteRuns = runsRepo.db.prepare(`SELECT * FROM scheduler_runs WHERE status = 'running'`).all();
    for (const run of incompleteRuns) {
      runsRepo.update(run.id, {
        status: 'failed',
        end_time: new Date().toISOString(),
        failure_reason: 'System crashed or was forcibly terminated',
        graceful_shutdown: 0
      });
      logger.warn(`Recovered incomplete run ${run.id} and marked as failed.`);
    }

    // Recover orphaned connections
    const orphanedConnections = runsRepo.db.prepare(`SELECT id, profile_url, status FROM connections WHERE status IN ('pending', 'sending_connection')`).all();
    if (orphanedConnections.length > 0) {
      for (const conn of orphanedConnections) {
        runsRepo.db.prepare(`UPDATE connections SET status = 'failed', last_action = 'crash_recovery', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(conn.id);
        logger.warn(`Recovered orphaned connection ${conn.profile_url} and marked as failed.`);
      }
    }
  } catch (e) {
    logger.error('Failed to perform crash recovery', { error: e.message });
  }
```

- [ ] **Step 2: Commit Task 5**
```bash
git add src/scheduler.js
git commit -m "feat: implement crash recovery for orphaned database records"
```
