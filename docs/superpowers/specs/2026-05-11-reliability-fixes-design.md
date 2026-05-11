# Reliability Fixes Design

## Goal
Transform the scheduler from "works locally" to "safe for long-running unattended operation" by improving timeouts, session safety, concurrency, state optimization, error handling, and crash recovery.

## Architecture & Components

### 1. Task-Level Timeouts
- **Component:** `src/utils/helpers.js` (`withTimeout`)
- **Approach:** Introduce Playwright default timeouts (`page.setDefaultTimeout(15000)`) and an `AbortSignal`-based wrapper for Claude API calls. This prevents hanging promises from locking the scheduler indefinitely. The timeout errors will be structured and clearly logged.

### 2. Mid-Loop Session Safety Checks
- **Component:** `src/utils/helpers.js` (`isSessionValid`, `humanType`, `humanClick`, `randomDelay`), `src/task-connect.js`
- **Approach:** Inject the `isSessionValid` check organically into delay and interaction utilities. This ensures any CAPTCHA or restriction encountered *between* processing steps immediately triggers an `EmergencyStopError`, escalating and halting the session securely.

### 3. Atomic Upsert / Concurrency Safety
- **Component:** `shared/repositories/ConnectionRepository.js`, `src/utils/helpers.js` (`updateConnectionRecord`)
- **Approach:** Eliminate the JavaScript-level read-then-write pattern in `updateConnectionRecord`. Rely entirely on SQLite's `INSERT ... ON CONFLICT DO UPDATE`. Modify the SQL query to use `COALESCE(excluded.status, connections.status)` to ensure partial updates do not overwrite existing data with nulls.

### 4. Runtime State Optimization
- **Component:** `backend-api/services/RuntimeStateService.js`
- **Approach:** Implement debouncing for pulse updates. The service will immediately commit state transitions (e.g., `ACTIVE` to `IDLE`) or 100% completions, but will batch and debounce intermediate progress updates to reduce SQLite I/O load.

### 5. Scheduler Run History
- **Component:** `src/scheduler.js`, `src/task-connect.js`, `src/task-feed.js`
- **Approach:** Tasks will return a structured result object (e.g., `{ recordsProcessed: number }`). The scheduler will capture this output, calculate the true duration, and write complete run summaries (including `failure_reason` and `graceful_shutdown`) to the `scheduler_runs` table.

### 6. Interruptible Human Delays
- **Component:** `src/utils/helpers.js`
- **Approach:** Define a custom `EmergencyStopError` extending `Error`. `randomDelay` and interaction functions will throw this specific error when interrupted. Catch blocks in loops will check `err instanceof EmergencyStopError` and cleanly exit, preventing interrupted profiles from being falsely marked as "failed".

### 7. Crash Recovery
- **Component:** `src/scheduler.js`
- **Approach:** On startup, before launching tasks, the scheduler will query the `connections` table for records left in volatile stages (e.g., `sending_connection` or `pending`). It will transition these orphaned records to `failed` with the reason "crash recovery" to guarantee idempotent retries and prevent double-sends.

### 8. Operational Visibility
- **Component:** `src/utils/helpers.js` (`getSystemState`)
- **Approach:** Extend `getSystemState` to reliably return `lastSuccessfulRun`, `currentTask`, `activeWorkflow`, `pendingReviewQueueCount`, `emergencyStop` status, and `lastFailureReason` from the `scheduler_runs` and `review_queue` tables.

## Testing & Validation
Each fix will be validated independently. We will simulate timeouts, manually trigger emergency stops during delays to verify the custom error, run concurrent upserts to test SQLite locks, and forcefully terminate the node process to verify crash recovery on restart.