# CUE AI Outreach - Phase C: Security + Reliability Design

## 1. Authentication Strategy (Local-First)
- **Mechanism:** Environment Variable Authentication.
- **Requirement:** `DASHBOARD_PASSWORD` must be present in `.env` or the system will fail to boot.
- **Implementation:**
  - On startup, the password is hashed using `scrypt` and stored **only** in memory.
  - **Login:** `POST /api/auth/login` verifies the password and issues a 24h HttpOnly, SameSite=Lax, Secure session cookie.
  - **Security:** Rate limiting on the login endpoint; lock login after 5 consecutive failures.
  - **Binding:** API binds strictly to `127.0.0.1`.
- **Endpoints:**
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/session` (verify status)

## 2. Proactive Alerting (Telegram/Slack)
- **Service:** `AlertService` abstraction with Telegram (primary) and Slack (secondary) support.
- **Alert Levels:**
  - **CRITICAL:** LinkedIn checkpoints, CAPTCHAs, invalid sessions, scheduler crashes, emergency stops, task timeouts.
  - **WARNING:** Low AI success rate, high rejection rates, unusual LinkedIn patterns.
- **Operational Logic:**
  - **Deduplication:** Debounce duplicate alerts to prevent "alert storms."
  - **Cooldown:** Configurable windows between repeated alerts for the same issue.
  - **Aggregation:** Aggregate repeated failures into a single summary alert.
  - **Context:** Every alert includes a timestamp, task name, and actionable reason.

## 3. Crash Recovery (Safe Restart + Idempotency)
- **Principle:** No browser-level replay. Use idempotent tasks and state tracking.
- **Task States:** `pending`, `processing`, `completed`, `failed`, `interrupted`.
- **Workflow:**
  - **Startup Recovery:** On boot, the system scans `runtime_state` for stale `processing` or `interrupted` records.
  - **Idempotency:** Every outbound task (message, connect, comment) checks the SQLite DB for an existing `completed` status for that specific Run UUID/Profile before acting.
  - **Metadata:** Store `run_uuid`, `task_execution_id`, and `last_successful_step_timestamp` in SQLite.
  - **Timeout:** Automatically mark `processing` tasks older than X minutes as `interrupted`.

## 4. Structured Logging (Winston)
- **Rotation:** Daily rotation with `maxsize: 20m` and `maxFiles: 14`.
- **Streams:**
  - `automation.log`: General runtime and task progress.
  - `errors.log`: Stack traces and catch-all for failures.
  - `ai.log`: Raw prompts and responses for quality auditing.
  - `security.log`: Login attempts, auth failures, and rate limit triggers.

## 5. Startup Validation Checklist
1. Validate `.env` (DASHBOARD_PASSWORD, API keys).
2. Check SQLite DB integrity (`PRAGMA integrity_check`).
3. Verify Claude/Gemini connectivity.
4. Scan for and resolve stale `processing` task states.
5. Initialize AlertService.
