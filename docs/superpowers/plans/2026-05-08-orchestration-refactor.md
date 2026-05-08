# Orchestration Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the runtime orchestration layer to use SQLite, implement cooperative interrupts, and build a real-time operator console.

**Architecture:** Transition from NDJSON to a SQLite-backed repository layer. Implement a `RuntimeStateService` for global flags and cooperative interrupts. Hardened Express API for control and a React-based dashboard for visibility.

**Tech Stack:** Node.js, Express, better-sqlite3, React, Tailwind, Playwright.

---

### Task 1: SQLite Infrastructure and Schema

**Files:**
- Create: `backend-api/db/schema.sql`
- Create: `backend-api/db/init.js`
- Modify: `package.json`

- [ ] **Step 1: Add better-sqlite3 dependency**
Run: `npm install better-sqlite3`

- [ ] **Step 2: Create SQLite Schema**
Create `backend-api/db/schema.sql` with the following:
```sql
CREATE TABLE IF NOT EXISTS runtime_state (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_url TEXT UNIQUE,
    status TEXT,
    last_action TEXT,
    data TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_url TEXT,
    thread_id TEXT,
    content TEXT,
    direction TEXT, -- 'sent', 'received'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS review_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT, -- 'message', 'connection', 'post'
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'completed'
    data TEXT, -- JSON blob of the item
    response TEXT, -- Final text to be sent/posted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prompt_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT, -- e.g., 'connect-message'
    version INTEGER,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT,
    module TEXT,
    details TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scheduler_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    status TEXT -- 'running', 'completed', 'failed'
);

-- Seed initial runtime state
INSERT OR IGNORE INTO runtime_state (key, value) VALUES ('scheduler_enabled', 'false');
INSERT OR IGNORE INTO runtime_state (key, value) VALUES ('emergency_stop', 'false');
```

- [ ] **Step 3: Create Database Initialization Script**
Create `backend-api/db/init.js`:
```javascript
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('database/cue-os.sqlite');
const schemaPath = path.resolve('backend-api/db/schema.sql');

if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

export default db;
```

- [ ] **Step 4: Verify Database Creation**
Run: `node -e "import('./backend-api/db/init.js')" (using proper ESM flags or node 20+)`
Verify `database/cue-os.sqlite` exists.

- [ ] **Step 5: Commit**
```bash
git add package.json backend-api/db/schema.sql backend-api/db/init.js
git commit -m "feat: initialize sqlite database and schema"
```

---

### Task 2: SQLite Repository Layer

**Files:**
- Create: `shared/repositories/SqliteRepository.js`
- Create: `shared/repositories/RuntimeStateRepository.js`
- Create: `shared/repositories/ActivityRepository.js`

- [ ] **Step 1: Create SqliteRepository Base Class**
```javascript
import db from '../../backend-api/db/init.js';

export class SqliteRepository {
    constructor(tableName) {
        this.tableName = tableName;
        this.db = db;
    }

    findAll() {
        return this.db.prepare(`SELECT * FROM ${this.tableName}`).all();
    }

    findById(id) {
        return this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`).get(id);
    }

    create(data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map(() => '?').join(',');
        const info = this.db.prepare(
            `INSERT INTO ${this.tableName} (${keys.join(',')}) VALUES (${placeholders})`
        ).run(...values);
        return { ...data, id: info.lastInsertRowid };
    }

    update(id, data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const setClause = keys.map(k => `${k} = ?`).join(',');
        this.db.prepare(
            `UPDATE ${this.tableName} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).run(...values, id);
        return this.findById(id);
    }
}
```

- [ ] **Step 2: Create RuntimeStateRepository**
```javascript
import { SqliteRepository } from './SqliteRepository.js';

export class RuntimeStateRepository extends SqliteRepository {
    constructor() {
        super('runtime_state');
    }

    get(key) {
        const row = this.db.prepare(`SELECT value FROM runtime_state WHERE key = ?`).get(key);
        return row ? JSON.parse(row.value) : null;
    }

    set(key, value) {
        const jsonValue = JSON.stringify(value);
        this.db.prepare(
            `INSERT OR REPLACE INTO runtime_state (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`
        ).run(key, jsonValue);
    }
}
```

- [ ] **Step 3: Commit**
```bash
git add shared/repositories/SqliteRepository.js shared/repositories/RuntimeStateRepository.js
git commit -m "feat: implement sqlite base and runtime state repositories"
```

---

### Task 3: Migration from NDJSON to SQLite

**Files:**
- Create: `scripts/migrate-to-sqlite.js`

- [ ] **Step 1: Write Migration Script**
Read existing NDJSON files (if they exist) and insert into SQLite.
- [ ] **Step 2: Run Migration**
`node scripts/migrate-to-sqlite.js`
- [ ] **Step 3: Commit**
```bash
git add scripts/migrate-to-sqlite.js
git commit -m "feat: add ndjson to sqlite migration script"
```

---

### Task 4: RuntimeStateService and Cooperative Interrupts

**Files:**
- Create: `backend-api/services/RuntimeStateService.js`
- Modify: `src/utils/helpers.js`
- Modify: `src/scheduler.js`

- [ ] **Step 1: Implement RuntimeStateService**
```javascript
import { RuntimeStateRepository } from '../../shared/repositories/RuntimeStateRepository.js';

const repo = new RuntimeStateRepository();

export const RuntimeStateService = {
    getFlag: (key) => repo.get(key),
    setFlag: (key, value) => repo.set(key, value),
    shouldStop: (moduleName) => {
        const stop = repo.get('emergency_stop');
        const moduleDisabled = repo.get(`${moduleName}_enabled`) === false;
        return stop || moduleDisabled;
    },
    emergencyStop: () => repo.set('emergency_stop', true)
};
```

- [ ] **Step 2: Add Interrupt Checks to Scheduler**
Update `src/scheduler.js` to check `emergency_stop` before each task.

- [ ] **Step 3: Commit**
```bash
git add backend-api/services/RuntimeStateService.js src/scheduler.js
git commit -m "feat: implement RuntimeStateService and scheduler interrupt checks"
```

---

### Task 5: Automation Task Interrupts

**Files:**
- Modify: `src/task-connect.js`
- Modify: `src/task-feed.js`
- Modify: `src/task-first-message.js`

- [ ] **Step 1: Inject shouldStop checks**
In each loop (e.g., between profiles, before clicking connect), add:
```javascript
if (await RuntimeStateService.shouldStop('connect')) {
    logger.info('Connect task interrupted by system signal');
    await browser.close();
    return;
}
```

---

### Task 6: Approval Queue and Activity Logging

**Files:**
- Create: `shared/repositories/ReviewQueueRepository.js`
- Modify: `src/utils/logger.js` (to also log to DB)

- [ ] **Step 1: Implement ReviewQueueRepository**
- [ ] **Step 2: Update Logger to emit DB activity events**
- [ ] **Step 3: Commit**

---

### Task 7: Security Hardening and Sanitization

**Files:**
- Create: `backend-api/middleware/security.js`
- Create: `src/utils/sanitizer.js`

- [ ] **Step 1: Security Middleware**
Rate limiting, CORS local bind, CSRF.
- [ ] **Step 2: Prompt Sanitizer**
`sanitizePromptInput(text)` to remove injection patterns.

---

### Task 8: Frontend Dashboard Refactor

**Files:**
- Modify: `frontend/app/page.tsx`
- Create: `frontend/components/dashboard/ControlPanel.tsx`
- Create: `frontend/components/dashboard/ActivityFeed.tsx`

- [ ] **Step 1: Implement Control Panel with Toggles**
- [ ] **Step 2: Implement Live Activity Feed using Polling**
- [ ] **Step 3: Implement Review Queue Inbox**
