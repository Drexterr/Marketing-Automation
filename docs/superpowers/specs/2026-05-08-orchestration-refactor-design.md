# CUE AI Outreach OS - Runtime Orchestration Refactor Design

## 1. Overview
The goal of this refactor is to stabilize the CUE AI Outreach OS runtime orchestration layer. This involves replacing the current append-only NDJSON storage with a robust SQLite database, creating a single source of truth for runtime state, implementing cooperative interrupts for long-running Playwright tasks, and building a real review workflow and operational dashboard.

## 2. Architecture Target
- `/frontend`: React, Tailwind, shadcn/ui, Zustand, TanStack Query, Recharts.
- `/backend-api`: Node.js Express API.
- `/src`: Existing automation tasks modified for cooperative interrupts and activity logging.
- `/database`: SQLite database (using `better-sqlite3` in WAL mode).
- `/shared`: Repositories and utilities.

## 3. Phase 1 - SQLite Migration
- **Stack**: `better-sqlite3`, WAL mode enabled.
- **Database File**: `database/cue-os.sqlite`
- **Tables**:
  - `runtime_state`: For global control flags (scheduler enabled, modules enabled).
  - `connections`: Track connection statuses.
  - `messages`: Track sent/received messages.
  - `review_queue`: For human-in-the-loop approvals.
  - `prompt_versions`: Store historical prompt configurations.
  - `activity_log`: Append-only activity stream.
  - `scheduler_runs`: Track start/end of schedule cycles.
- **Components**:
  - `backend-api/db/schema.sql`
  - `backend-api/db/init.js`
  - Repositories adapting `BaseRepository` to SQLite.

## 4. Phase 2 - Runtime State Bridge
- **Concept**: A unified, database-backed configuration replacing `config.json` and in-memory state.
- **RuntimeStateService**:
  - `getFlag(key)`
  - `setFlag(key, value)`
  - `shouldStop(moduleName)`
  - `emergencyStop()`
  - `getAllFlags()`

## 5. Phase 3 - Cooperative Interrupts
- Long-running Playwright scripts (`task-connect.js`, `task-feed.js`, etc.) will periodically poll `runtimeState.shouldStop(moduleName)`.
- If a stop signal is received, they will gracefully close the browser and exit.

## 6. Phase 4 - Approval Queue System
- Transform the existing append-only queue into a mutable review pipeline.
- States: `pending`, `approved`, `rejected`, `completed`.
- **API Routes**:
  - `GET /api/review-queue`
  - `PATCH /api/review-queue/:id`
  - `POST /api/review-queue/:id/respond`

## 7. Phase 5 - Security Hardening
- **Local Bind**: Express bound to `127.0.0.1`.
- **Middleware**: `express-rate-limit` for auth, token expiry (24h), SameSite cookies, CSRF protection.
- **Sanitization**: `sanitizePromptInput()` to strip HTML, control chars, and injection patterns before LLM execution.

## 8. Phase 6 - Operational Dashboard
- A React-based operator console with pages:
  - **Dashboard**: Live statuses, daily metrics.
  - **Activity Feed**: Real-time event stream.
  - **Inbox**: Human-in-the-loop review interface.
  - **Controls**: Toggles, cron settings, emergency stop.
  - **Prompt Manager**: View and rollback prompt configurations.
  - **Analytics**: Key conversion metrics.

## 9. Phase 7 - Prompt Versioning
- **API Routes**:
  - `GET /api/prompts/history`
  - `POST /api/prompts/rollback/:versionId`
- All prompt saves will generate a new version record.

## 10. Phase 8 - Activity Pipeline
- Automation scripts will emit structured events to the `activity_log` table (e.g., `connection_sent`, `scheduler_started`).

## 11. Phase 9 - Frontend Quality
- **Stack**: React, Tailwind, shadcn/ui.
- **State/Data**: Zustand (local/UI state), TanStack Query (server state).
- **Features**: Dark mode, responsive, optimistic updates, live polling.

## 12. Trade-offs and Constraints
- We will preserve the existing Playwright logic, inserting interrupt checks at natural boundaries.
- We deliberately avoid adding a cache layer (Redis) or full RDBMS (PostgreSQL) in favor of the simpler, highly capable `better-sqlite3`.
