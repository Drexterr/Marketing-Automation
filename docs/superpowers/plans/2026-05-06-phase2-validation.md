# Phase 2: Dry Run Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement AI-driven connection requests and feed commenting with human-like behavior and weekly limits.

**Architecture:** Extend `BrowserManager` and `ClaudeService` to support new tasks. Implement `src/task-connect.js` and `src/task-feed.js` for core workflows. Use JSON files in `data/` for persistence and limit enforcement.

**Tech Stack:** Node.js, Playwright, Anthropic SDK, Winston.

---

### Task 1: Claude Service Enhancements

**Files:**
- Modify: `src/claude-service.js`

- [ ] **Step 1: Implement `evaluateConnectionTarget`**
Add logic to evaluate a profile based on name and headline. Use a prompt that defines the ICP (Developers, Founders, Technical roles) and scoring rubrics.

- [ ] **Step 2: Implement `generateConnectionNote`**
Add logic to generate a short (<300 chars) connection note. Include few-shot examples for natural, founder-to-founder tone.

- [ ] **Step 3: Implement `generateFeedComment`**
Add logic to generate a short, relevant comment for a LinkedIn post.

- [ ] **Step 4: Commit**
```bash
git add src/claude-service.js
git commit -m "feat: add Claude intelligence methods for profile evaluation and note generation"
```

---

### Task 2: Utilities & Limit Enforcement

**Files:**
- Create: `src/utils/helpers.js`

- [ ] **Step 1: Implement `randomDelay`**
```javascript
export const randomDelay = (min = 5000, max = 15000) => {
  const delay = Math.floor(Math.random() * (max - min + 1) + min);
  return new Promise(resolve => setTimeout(resolve, delay));
};
```

- [ ] **Step 2: Implement `checkWeeklyLimit`**
Logic to count entries in `data/connections-sent.json` from the last 7 days and compare against `WEEKLY_CONNECTION_LIMIT`.

- [ ] **Step 3: Implement `logAction`**
Generic helper to append entries to `data/connections-sent.json` or `data/comments-sent.json`.

- [ ] **Step 4: Commit**
```bash
git add src/utils/helpers.js
git commit -m "feat: add utilities for random delays and weekly limit enforcement"
```

---

### Task 3: Connection Workflow

**Files:**
- Create: `src/task-connect.js`

- [ ] **Step 1: Implement search and extraction**
Navigate to LinkedIn search with keywords from `TARGET_KEYWORDS`. Extract profile data (name, headline, URL).

- [ ] **Step 2: Implement evaluation and sending loop**
For each profile, evaluate with Claude. If score >= threshold, generate note and send connection request. Include scrolling and random delays.

- [ ] **Step 3: Log results**
Use `logAction` to record each sent request.

- [ ] **Step 4: Commit**
```bash
git add src/task-connect.js
git commit -m "feat: implement automated connection request workflow with AI evaluation"
```

---

### Task 4: Feed Commenting Workflow

**Files:**
- Create: `src/task-feed.js`

- [ ] **Step 1: Implement feed scrolling**
Navigate to feed, scroll, and pick 3-5 posts.

- [ ] **Step 2: Implement commenting loop**
Generate comments with Claude and post them. Include random delays.

- [ ] **Step 3: Log results**
Record sent comments to `data/comments-sent.json`.

- [ ] **Step 4: Commit**
```bash
git add src/task-feed.js
git commit -m "feat: implement automated feed commenting workflow"
```

---

### Task 5: CLI Integration & Config

**Files:**
- Modify: `src/index.js`
- Modify: `.env.example`

- [ ] **Step 1: Add `connect` and `feed` commands to `src/index.js`**
Handle the new commands and call the respective tasks. Ensure proper error handling.

- [ ] **Step 2: Update `.env.example`**
Add `WEEKLY_CONNECTION_LIMIT`, `TARGET_KEYWORDS`, etc.

- [ ] **Step 3: Commit**
```bash
git add src/index.js .env.example
git commit -m "feat: expose connect and feed commands via CLI"
```
