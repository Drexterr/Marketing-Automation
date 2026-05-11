# SQLite Migration for ConnectionRepository Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the migration from NDJSON (`connections-sent.json`) to SQLite for all connection-related data by updating `ConnectionRepository` and refactoring all dependent modules.

**Architecture:** Use `ConnectionRepository` (extending `SqliteRepository`) to centralize all connection persistence. Store detailed profile info in a `data` JSON column while keeping `profile_url`, `status`, and `last_action` as top-level searchable columns.

**Tech Stack:** Node.js, SQLite (better-sqlite3), SqliteRepository pattern.

---

### Task 1: Enhance ConnectionRepository

**Files:**
- Modify: `shared/repositories/ConnectionRepository.js`
- Test: `shared/repositories/ConnectionRepository.test.js`

- [ ] **Step 1: Update ConnectionRepository with migration methods**
  Implement `countSentInLast7Days`, `countSentToday`, and ensure `upsert` handles the `data` blob correctly.

```javascript
import { SqliteRepository } from './SqliteRepository.js';

export class ConnectionRepository extends SqliteRepository {
    constructor() {
        super('connections');
    }

    findByProfileUrl(profileUrl) {
        return this.db.prepare(`SELECT * FROM connections WHERE profile_url = ?`).get(profileUrl);
    }

    upsert(profileUrl, status, lastAction, data) {
        const existing = this.findByProfileUrl(profileUrl);
        const record = {
            profile_url: profileUrl,
            status,
            last_action: lastAction,
            data: JSON.stringify(data)
        };

        if (existing) {
            return this.update(existing.id, record);
        } else {
            return this.create(record);
        }
    }

    countSentInLast7Days() {
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        return this.db.prepare(`
            SELECT COUNT(*) as count FROM connections 
            WHERE status = 'sent' AND updated_at > ?
        `).get(oneWeekAgo).count;
    }

    countSentToday() {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const startOfDayIso = startOfDay.toISOString();
        return this.db.prepare(`
            SELECT COUNT(*) as count FROM connections 
            WHERE (status = 'sent' OR status = 'accepted') AND updated_at > ?
        `).get(startOfDayIso).count;
    }

    findAllConnections() {
        const records = this.findAll();
        return records.map(r => ({
            ...JSON.parse(r.data),
            id: r.id,
            profile_url: r.profile_url,
            status: r.status,
            last_action: r.last_action,
            updated_at: r.updated_at
        }));
    }
}
```

- [ ] **Step 2: Create/Update tests for ConnectionRepository**
- [ ] **Step 3: Run tests**
- [ ] **Step 4: Commit**

### Task 2: Refactor `src/utils/helpers.js`

**Files:**
- Modify: `src/utils/helpers.js`

- [ ] **Step 1: Replace file-based helpers with Repository-based ones**
  Update `appendConnection`, `checkDailyLimit`, `updateConnectionRecord`, `loadConnections`, and `checkWeeklyLimit` to use `ConnectionRepository`.

- [ ] **Step 2: Commit**

### Task 3: Refactor `src/task-connect.js`

**Files:**
- Modify: `src/task-connect.js`

- [ ] **Step 1: Remove `CONNECTIONS_SENT_FILE` and update logic to use new helpers**
- [ ] **Step 2: Commit**

### Task 4: Refactor other dependent tasks

**Files:**
- Modify: `src/analytics.js`
- Modify: `src/dashboard-server.js`
- Modify: `src/task-first-message.js`
- Modify: `src/task-followups.js`
- Modify: `src/task-reply-check.js`
- Modify: `src/task-reply-respond.js`

- [ ] **Step 1: Update all these files to remove direct JSON/NDJSON references**
- [ ] **Step 2: Commit**

### Task 5: Final Cleanup and Verification

- [ ] **Step 1: Run migration script if needed**
- [ ] **Step 2: Remove `data/connections-sent.json`**
- [ ] **Step 3: Run all tests**
- [ ] **Step 4: Commit**
