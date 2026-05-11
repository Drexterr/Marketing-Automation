# SQLite Migration Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the SQLite migration for connection data by refactoring dependent task modules to use updated helpers and removing direct JSON file dependencies.

**Architecture:** Refactor `src/task-*.js` files to use `ConnectionRepository` via `src/utils/helpers.js`, eliminating the `CONNECTIONS_SENT_FILE` constant and direct file path passing.

**Tech Stack:** Node.js, SQLite (via `better-sqlite3`), Node Test Runner.

---

### Task 1: Refactor `src/task-first-message.js`

**Files:**
- Modify: `src/task-first-message.js`

- [ ] **Step 1: Remove `CONNECTIONS_SENT_FILE` and update helper calls**

```javascript
// Remove: const CONNECTIONS_SENT_FILE = ...
// Update loadConnections(CONNECTIONS_SENT_FILE) -> loadConnections()
// Update updateConnectionRecord(CONNECTIONS_SENT_FILE, ...) -> updateConnectionRecord(undefined, ...)
```

- [ ] **Step 2: Commit**

```bash
git add src/task-first-message.js
git commit -m "refactor: use sqlite for first-message task"
```

---

### Task 2: Refactor `src/task-followups.js`

**Files:**
- Modify: `src/task-followups.js`

- [ ] **Step 1: Remove `CONNECTIONS_SENT_FILE` and update helper calls**

```javascript
// Remove: const CONNECTIONS_SENT_FILE = ...
// Update loadConnections(CONNECTIONS_SENT_FILE) -> loadConnections()
// Update updateConnectionRecord(CONNECTIONS_SENT_FILE, ...) -> updateConnectionRecord(undefined, ...)
```

- [ ] **Step 2: Commit**

```bash
git add src/task-followups.js
git commit -m "refactor: use sqlite for followups task"
```

---

### Task 3: Refactor `src/task-reply-check.js`

**Files:**
- Modify: `src/task-reply-check.js`

- [ ] **Step 1: Remove `CONNECTIONS_SENT_FILE` and update helper calls**

```javascript
// Remove: const CONNECTIONS_SENT_FILE = ...
// Update updateConnectionRecord(CONNECTIONS_SENT_FILE, ...) -> updateConnectionRecord(undefined, ...)
```

- [ ] **Step 2: Commit**

```bash
git add src/task-reply-check.js
git commit -m "refactor: use sqlite for reply-check task"
```

---

### Task 4: Refactor `src/task-reply-respond.js`

**Files:**
- Modify: `src/task-reply-respond.js`

- [ ] **Step 1: Remove `CONNECTIONS_SENT_FILE` and update helper calls**

```javascript
// Remove: const CONNECTIONS_SENT_FILE = ...
// Update loadConnections(CONNECTIONS_SENT_FILE) -> loadConnections()
// Update updateConnectionRecord(CONNECTIONS_SENT_FILE, ...) -> updateConnectionRecord(undefined, ...)
```

- [ ] **Step 2: Commit**

```bash
git add src/task-reply-respond.js
git commit -m "refactor: use sqlite for reply-respond task"
```

---

### Task 5: Verification and Cleanup

- [ ] **Step 1: Run all tests**

Run: `node --test`
Expected: All tests pass.

- [ ] **Step 2: Delete legacy NDJSON file**

Run: `rm data/connections-sent.json`

- [ ] **Step 3: Check for remaining references**

Run: `grep -r "connections-sent.json" src/ shared/`
Expected: No matches in these directories (except possibly in `helpers.js` compatibility check).

- [ ] **Step 4: Commit cleanup**

```bash
git add data/connections-sent.json
git commit -m "chore: remove legacy connections-sent.json"
```
