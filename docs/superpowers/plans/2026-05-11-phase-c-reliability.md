# Phase C: Security + Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the system for safe, unattended operation by implementing local-first authentication, proactive alerting, idempotent crash recovery, and structured logging.

**Architecture:** Environment-based password hashing (scrypt); debounced Telegram/Slack AlertService; State-tracked task lifecycle in SQLite; Winston-based log rotation.

**Tech Stack:** Node.js, Express, better-sqlite3, winston, winston-daily-rotate-file, node-telegram-bot-api (or fetch).

---

### Task 1: Environment-Based Authentication

**Files:**
- Modify: `backend-api/middleware/auth.js`
- Modify: `backend-api/routes/auth.js`
- Modify: `src/index.js` (validation)

- [ ] **Step 1: Write the failing test for env-auth**

```javascript
// backend-api/middleware/auth.test.js
import { verifyPassword, hashPassword } from './auth.js';
import assert from 'node:assert';
import test from 'node:test';

test('verifyPassword matches against hashed env password', () => {
    const raw = 'test-pass';
    const hashed = hashPassword(raw);
    assert.ok(verifyPassword(raw, hashed));
});
```

- [ ] **Step 2: Implement password hashing and HttpOnly cookie logic**

```javascript
// backend-api/middleware/auth.js
// On startup, hash process.env.DASHBOARD_PASSWORD
// Use cookie-parser for session management
```

- [ ] **Step 3: Update login route to issue secure cookies**

```javascript
// backend-api/routes/auth.js
// POST /login -> verify -> res.cookie('session_token', token, { httpOnly: true, secure: true })
```

- [ ] **Step 4: Commit**

```bash
git add backend-api/middleware/auth.js backend-api/routes/auth.js
git commit -m "feat: implement environment-based auth with HttpOnly cookies"
```

---

### Task 2: Proactive Alert Service

**Files:**
- Create: `src/utils/alerts.js`
- Test: `src/utils/alerts.test.js`

- [ ] **Step 1: Create AlertService with debouncing**

```javascript
// src/utils/alerts.js
export const AlertService = {
    sendCritical: async (msg) => { ... },
    sendWarning: async (msg) => { ... },
    // Implement cooldown logic using a Map of last alert timestamps
};
```

- [ ] **Step 2: Add Telegram/Slack integration**

```javascript
// Use fetch to post to Telegram Bot API or Slack Webhooks
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/alerts.js
git commit -m "feat: implement proactive AlertService with debouncing"
```

---

### Task 4: Structured Logging & Rotation

**Files:**
- Modify: `src/utils/logger.js`

- [ ] **Step 1: Install winston-daily-rotate-file**

Run: `node -e "require('child_process').execSync('npm install winston-daily-rotate-file', {stdio: 'inherit'})"`

- [ ] **Step 2: Configure multiple log streams and rotation**

```javascript
// src/utils/logger.js
// automation.log, errors.log, ai.log, security.log
// maxsize: 20m, maxFiles: 14d
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/logger.js
git commit -m "feat: add winston log rotation and separate security/ai streams"
```

---

### Task 5: Startup Validation & Recovery

**Files:**
- Modify: `src/index.js`

- [ ] **Step 1: Implement system validation check**

```javascript
function validateSystem() {
    if (!process.env.DASHBOARD_PASSWORD) throw new Error('DASHBOARD_PASSWORD missing');
    // Check DB integrity, Claude connection, etc.
}
```

- [ ] **Step 2: Integrate into entry point**

- [ ] **Step 3: Commit**

```bash
git add src/index.js
git commit -m "feat: add startup validation and system guardrails"
```
