# Scheduler Run History & Task Timeouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement scheduler run history tracking by capturing records processed from tasks and add robust timeout handling with memory leak prevention and AbortController support.

**Architecture:**
- Update `withTimeout` in `src/utils/helpers.js` to handle `AbortController`.
- Modify `src/task-connect.js` and `src/task-feed.js` to return `{ recordsProcessed: N }`.
- Update `src/scheduler.js` to catch these results and update the `scheduler_runs` table.

**Tech Stack:** Node.js, SQLite.

---

### Task 1: Update `withTimeout` in `helpers.js`

**Files:**
- Modify: `src/utils/helpers.js`
- Test: `src/utils/helpers.test.js`

- [ ] **Step 1: Write failing tests for `withTimeout`**

Add tests to `src/utils/helpers.test.js` that check for timeout and AbortController support.

```javascript
  describe('withTimeout', () => {
    it('should resolve if promise resolves before timeout', async () => {
      const result = await withTimeout(Promise.resolve('success'), 100, 'test');
      assert.strictEqual(result, 'success');
    });

    it('should reject if promise takes longer than timeout', async () => {
      const slowPromise = new Promise(resolve => setTimeout(() => resolve('slow'), 200));
      await assert.rejects(
        withTimeout(slowPromise, 100, 'test'),
        { message: 'Timeout exceeded: test took longer than 100ms' }
      );
    });

    it('should support AbortController if provided', async () => {
      const controller = new AbortController();
      const task = (signal) => new Promise((resolve, reject) => {
        const timeout = setTimeout(() => resolve('done'), 200);
        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new Error('Aborted'));
        });
      });

      const promise = withTimeout(task(controller.signal), 100, 'aborted-task', controller);
      await assert.rejects(promise, { message: 'Timeout exceeded: aborted-task took longer than 100ms' });
      assert.strictEqual(controller.signal.aborted, true);
    });
  });
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `node --test src/utils/helpers.test.js`
Expected: FAIL (or `withTimeout` doesn't exist in tests yet)

- [ ] **Step 3: Implement updated `withTimeout`**

```javascript
export function withTimeout(promise, ms, operationName, controller = null) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      if (controller) {
        controller.abort();
      }
      reject(new Error(`Timeout exceeded: ${operationName} took longer than ${ms}ms`));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `node --test src/utils/helpers.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/helpers.js src/utils/helpers.test.js
git commit -m "feat: add AbortController support and memory leak protection to withTimeout"
```

### Task 2: Make `runConnectionWorkflow` return counts

**Files:**
- Modify: `src/task-connect.js`

- [ ] **Step 1: Update `runConnectionWorkflow` to return records processed**

```javascript
  // At the end of runConnectionWorkflow in src/task-connect.js
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

- [ ] **Step 2: Commit**

```bash
git add src/task-connect.js
git commit -m "feat: make runConnectionWorkflow return processed record counts"
```

### Task 3: Make `runFeedCommenting` return counts

**Files:**
- Modify: `src/task-feed.js`

- [ ] **Step 1: Update `runFeedCommenting` to return records processed**

```javascript
    if (scrollAttempts >= MAX_SCROLL_ATTEMPTS) {
      logger.warn('Feed exhausted — exiting early');
    }

    return { recordsProcessed: commentsSent };

  } catch (error) {
    if (error instanceof EmergencyStopError || error.message.includes('EmergencyStopError')) {
      logger.info('Feed commenting workflow aborted gracefully due to emergency stop.');
    } else {
      logger.error('Feed commenting workflow failed', { message: error.message });
    }
    return { recordsProcessed: commentsSent || 0 }; // Return partial progress if possible
  } finally {
    await browserManager.close();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/task-feed.js
git commit -m "feat: make runFeedCommenting return processed record counts"
```

### Task 4: Update `scheduler.js` to log history correctly

**Files:**
- Modify: `src/scheduler.js`

- [ ] **Step 1: Update `runScheduler` to capture and update records processed**

```javascript
      let totalRecords = 0;

      for (const task of tasks) {
        if (RuntimeStateService.getFlag('emergency_stop')) {
          logger.info('Scheduler: Emergency stop detected during task execution. Stopping further tasks.');
          break;
        }

        RuntimeStateService.setPulse({ status: 'ACTIVE', activeTask: task.name || 'Running task', progressPercent: 0 });
        try {
          // 15-minute timeout per major task
          const result = await withTimeout(task(), 15 * 60 * 1000, task.name || 'Anonymous Task');
          if (result && result.recordsProcessed) {
            totalRecords += result.recordsProcessed;
            runsRepo.update(currentRunId, { records_processed: totalRecords });
          }
        } catch (error) {
          logger.error(`Scheduler: Task failed or timed out`, { message: error.message });
          try {
            runsRepo.update(currentRunId, { failure_reason: error.message });
          } catch (e) {}
        }
        
        RuntimeStateService.setPulse({ status: 'ACTIVE', activeTask: `Waiting after ${task.name || 'task'}`, progressPercent: 100 });
```

- [ ] **Step 2: Commit**

```bash
git add src/scheduler.js
git commit -m "feat: track and update total records processed in scheduler runs"
```

### Task 5: Final Verification

- [ ] **Step 1: Run all tests to ensure no regressions**

Run: `npm test` (or equivalent)
Expected: All tests PASS

- [ ] **Step 2: Verify `scheduler_runs` table update logic (manual or via script if needed)**
Check if `scheduler_runs` is being updated with `records_processed`. Since I don't have a full live system easily testable, I'll rely on unit tests for components.
