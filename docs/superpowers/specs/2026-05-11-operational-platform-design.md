# CUE AI Outreach - Operational Platform Design

## 1. Architecture Plan
- **Runtime:** Node.js for backend API and automation runtime.
- **Browser Automation:** Playwright for LinkedIn interactions.
- **Data Storage:** SQLite (better-sqlite3) in WAL mode, replacing all NDJSON file usage.
- **Frontend:** React (Next.js) with Tailwind CSS and shadcn/ui for the operator dashboard.
- **Backend API:** Express.js serving the dashboard and managing runtime state.
- **Safety & Control:** A cooperative interrupt system replacing the uninterruptible `while(true)` scheduler, allowing the operator to emergency-stop or pause the system cleanly.

## 2. Migration Plan
1. **Phase A (Safety Fixes):** Implement cooperative cancellation, update `claude-cli.js` to remove `shell: true`, implement prompt sanitization, ensure all data persistence uses SQLite, and fix scheduler order.
2. **Phase B (Dashboard):** Build out the React dashboard, inbox, review queue, and runtime status pages. Connect them to the Express API.
3. **Phase C (Security & Reliability):** Add local-only authentication, health monitoring endpoints, Winston structured logging, and crash recovery logic.

## 3. DB Schema (SQLite)
```sql
CREATE TABLE IF NOT EXISTS runtime_state (key TEXT PRIMARY KEY, value TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS connections (id INTEGER PRIMARY KEY AUTOINCREMENT, profile_url TEXT UNIQUE, status TEXT, last_action TEXT, data TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, profile_url TEXT, thread_id TEXT, content TEXT, direction TEXT, created_at TIMESTAMP);
CREATE TABLE IF NOT EXISTS review_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, status TEXT DEFAULT 'pending', data TEXT, response TEXT, created_at TIMESTAMP, updated_at TIMESTAMP);
CREATE TABLE IF NOT EXISTS prompt_versions (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT, version INTEGER, content TEXT, created_at TIMESTAMP);
CREATE TABLE IF NOT EXISTS activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT, module TEXT, details TEXT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS scheduler_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, start_time TIMESTAMP, end_time TIMESTAMP, status TEXT);
CREATE TABLE IF NOT EXISTS analytics_daily (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT UNIQUE, pending_review INTEGER, connection_stats TEXT, reply_rates TEXT, ai_failures INTEGER, warnings INTEGER);
```

## 4. Folder Structure
```text
/backend-api/     (Express routes, middleware, db init)
/database/        (cue-os.sqlite files)
/frontend/        (Next.js dashboard app)
/shared/          (SQLite repositories, StateManager)
/src/             (Automation tasks, Playwright scripts, scheduler)
/logs/            (Winston logs: automation.log, errors.log, ai.log)
```

## 5. Implementation Phases
* **Phase A:** Focus on `src/scheduler.js`, `src/utils/claude-cli.js`, `src/claude-service.js`, and replacing `NdjsonRepository`.
* **Phase B:** Focus on `/frontend/app/` and `/backend-api/routes/`.
* **Phase C:** Focus on `backend-api/middleware/auth.js`, `backend-api/routes/health.js`, and Winston integration in `src/utils/logger.js`.

## 6. API Contracts
* `GET /api/state` - Fetch current runtime state.
* `POST /api/state/stop` - Trigger emergency stop.
* `POST /api/state/toggle` - Toggle specific modules.
* `GET /api/review-queue` - Fetch pending items.
* `PATCH /api/review-queue/:id` - Approve/edit/dismiss items.
* `GET /api/analytics` - Fetch daily stats.
* `GET /api/health` - Check DB, Claude, and Browser status.

## 7. React Component Structure
* `<DashboardLayout />` - Main wrapper with sidebar.
* `<RuntimeStatusWidget />` - Shows scheduler state, active task, next run.
* `<InboxViewer />` - Conversation thread viewer with AI drafts.
* `<ReviewQueueList />` - Table of pending tasks with approve/reject buttons.
* `<ActivityFeed />` - Real-time stream of `activity_log`.

## 8. Runtime State Model
```json
{
  "scheduler_enabled": true,
  "emergency_stop": false,
  "active_task": "task-feed",
  "last_run": "2026-05-11T09:00:00Z",
  "next_run": "2026-05-11T10:00:00Z",
  "modules": {
    "replies": true,
    "first_message": true,
    "connect": true,
    "feed": true
  }
}
```

## 9. Interrupt/Cooperative Cancellation Design
* `RuntimeStateService` will hold an in-memory flag backed by SQLite `runtime_state`.
* `Promise.race([task(), timeout(10 * 60 * 1000)])` wraps all top-level scheduler executions.
* Inside task loops (e.g., iterating profiles in `task-connect.js`), a check `if (RuntimeStateService.getFlag('emergency_stop')) return;` is evaluated before any network or browser action.
* Graceful SIGTERM handlers will flush the state and close Playwright safely.
