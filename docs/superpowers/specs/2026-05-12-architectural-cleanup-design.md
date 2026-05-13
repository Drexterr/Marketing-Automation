# Architectural Cleanup & Stabilization Design

## 1. Unified State Machine
**Current state:** Ad-hoc state changes with `status`, `stage`, and manual flag toggles.
**Proposed:**
- Define a single authoritative workflow state model in `RuntimeStateService`.
- Core States: `IDLE`, `RUNNING`, `PAUSED`, `ERROR`.
- Prevent invalid transitions (e.g. `ERROR -> PAUSED`) using a strict transition table.
- Emit structured analytics events when state transitions occur.

## 2. Scheduler Refactor
**Current state:** Uses `cron` but incorporates an `interruptibleSleep` inside a sequential task loop, leading to blocking behavior.
**Proposed:**
- Remove `interruptibleSleep` and instead schedule modular, independent cron jobs using `node-cron`.
- Implement robust overlapping run protection via the SQLite `scheduler_runs` table.
- Support enabling/disabling tasks independently and allow configurable schedules.

## 3. Review Queue Workflow
**Current state:** Basic POST actions (`resolve`, `dismiss`, `acknowledge`).
**Proposed:**
- Enforce strict workflow: `pending` -> `acknowledged` -> `resolved` / `dismissed`.
- Add `category`, `priority`, and timestamps tracking to the `ReviewQueueRepository`.
- Require `operatorNotes` during the `resolve` state transition.

## 4. Dashboard Operational UX
**Current state:** Lacks holistic visibility into automation health.
**Proposed:**
- Add metrics for `last run time`, `next run time`, and `current workflow` in the Dashboard UI.
- Implement live health indicators and a prominent failure banner for degraded operations.
- Show pending escalations and emergency stop status clearly.

## 5. Logging & Retention
**Current state:** `winston` logging exists, but SQLite activity logs grow indefinitely.
**Proposed:**
- Standardize structured logging formats across the app.
- Implement an automated retention policy: clean SQLite logs older than 30 days during scheduler startup.

## 6. Claude Failure Visibility
**Current state:** Silently handles errors up to 5 failures before degrading.
**Proposed:**
- Perform a startup health check (`testClaudeConnection()`).
- Expose granular AI health metrics (failure rates, retry counts) to the UI.

## 7. Configuration Validation
**Current state:** Loose configuration checks.
**Proposed:**
- Implement a startup config validation step in `index.js` or `server.js`.
- Ensure all required `.env` variables are present and provide sane defaults or runtime warnings if missing.

## 8. Long-Term Maintainability
**Proposed:**
- Audit `shared/` and `src/utils/` for duplicate helpers and dead code, consolidating where necessary.
- Ensure naming consistency across repositories and services.

This design preserves the SQLite primary datastore and the founder simplicity requirement. No new microservices are introduced.