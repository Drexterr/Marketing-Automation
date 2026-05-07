# Phase 4 Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the remaining production features for the LinkedIn outreach platform, including a scheduler, deep scraping, AI replies, and an analytics dashboard.

**Architecture:** A sequential orchestrator manages task execution with randomized timing. Deep scraping enhances profile data for Claude-based scoring. A hybrid AI reply workflow handles common questions while escalating high-intent leads. A local Express.js server provides real-time analytics.

**Tech Stack:** Node.js, Playwright, Claude API (Anthropic SDK), NDJSON, Express.js, Chart.js.

---

## Sub-Project 1: Scheduler & Orchestration

### Task 1: Create the Scheduler Module

**Files:**
- Create: `src/scheduler.js`
- Modify: `src/index.js`
- Test: `src/scheduler.test.js`

- [ ] **Step 1: Write a test for scheduler delay calculation**

```javascript
import { calculateNextRun } from './scheduler.js';
import assert from 'node:assert';

const now = new Date('2026-05-07T08:00:00Z');
const nextRun = calculateNextRun(now);
const diffMinutes = (nextRun - now) / (1000 * 60);

// Should be roughly 24 hours +/- 45 mins
assert(diffMinutes > (24 * 60 - 45) && diffMinutes < (24 * 60 + 45));
```

- [ ] **Step 2: Run test and verify failure**
Run: `node --test src/scheduler.test.js`
Expected: FAIL

- [ ] **Step 3: Implement `calculateNextRun` and `runScheduler`**

```javascript
import logger from './utils/logger.js';
import { randomBetween, getSystemState, updateSystemState } from './utils/helpers.js';

export function calculateNextRun(from = new Date()) {
  const next = new Date(from);
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0); // Default 9 AM
  const offset = randomBetween(-45, 45);
  next.setMinutes(next.getMinutes() + offset);
  return next;
}

export async function runScheduler(tasks) {
  const state = await getSystemState();
  let nextRun = state.nextScheduledRun ? new Date(state.nextScheduledRun) : calculateNextRun();
  
  while (true) {
    const now = new Date();
    if (now >= nextRun) {
      logger.info('Scheduler: Starting daily workflows...');
      for (const task of tasks) {
        await task();
        const gap = randomBetween(2, 10) * 60000;
        await new Promise(r => setTimeout(r, gap));
      }
      nextRun = calculateNextRun();
      await updateSystemState({ 
        lastCompletedRun: now.toISOString(),
        nextScheduledRun: nextRun.toISOString()
      });
    }
    await new Promise(r => setTimeout(r, 60000)); // Check every minute
  }
}
```

- [ ] **Step 4: Update `src/index.js` to support `schedule` command**

```javascript
// ... existing imports
import { runScheduler } from './scheduler.js';

// ... existing task functions

if (command === 'schedule') {
  const workflows = [replies, followups, connect, feed, analytics];
  runScheduler(workflows).catch(err => {
    logger.error('Scheduler crashed', { message: err.message });
    process.exit(1);
  });
}
```

- [ ] **Step 5: Run test and verify pass**
Run: `node --test src/scheduler.test.js`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git add src/scheduler.js src/index.js src/scheduler.test.js
git commit -m "feat: add cron scheduler and orchestrator"
```

---

## Sub-Project 2: Deep Profile Scraping & ICP Refinement

### Task 2: Implement Deep Profile Scraping in `task-connect.js`

**Files:**
- Modify: `src/task-connect.js`
- Modify: `src/claude-service.js`

- [ ] **Step 1: Add profile scraping logic to `src/task-connect.js`**

```javascript
// Inside runConnectionWorkflow, before evaluation
async function scrapeProfileDetails(page, profile) {
  logger.info(`Deep scraping profile: ${profile.name}`);
  await page.goto(profile.url, { waitUntil: 'networkidle' });
  await randomDelay(5000, 10000);

  const details = await page.evaluate(() => {
    const about = document.querySelector('#about ~ .pvs-list span[aria-hidden=true]')?.innerText || '';
    const isOpenToWork = !!document.querySelector('.pv-top-card-section__image-status-accent'); // Simplified selector
    return { about, isOpenToWork };
  });

  profile.about = details.about;
  profile.isOpenToWork = details.isOpenToWork;
  return profile;
}
```

- [ ] **Step 2: Update `evaluateConnectionTarget` in `src/claude-service.js` to use "About" and focus on job seekers**

```javascript
export async function evaluateConnectionTarget(profile) {
  const systemPrompt = `Score LinkedIn profiles 1–10. Target: Tech freshers, job seekers, and engineers "Open to Work".
Value Prop: CUE AI provides real-time interview practice and assistance.

SCORING:
9-10: "Open to Work" badge, active job seeking mentioned in About, fresher looking for first role.
7-8: Engineer with <2 years exp, looking for switch.
1-2: Recruiters, HR, unrelated fields.

Output ONLY JSON: { "score": 1-10, "reason": "one sentence" }`;

  const userPrompt = `Profile:
Name: ${profile.name}
Headline: ${profile.headline}
About: ${profile.about || 'Not provided'}
Open to Work: ${profile.isOpenToWork ? 'Yes' : 'No'}`;

  // ... rest of existing logic
}
```

- [ ] **Step 3: Commit**
```bash
git add src/task-connect.js src/claude-service.js
git commit -m "feat: implement deep profile scraping and job-seeker scoring"
```

---

## Sub-Project 3: AI Reply & Follow-up

### Task 3: Implement AI-Assisted Reply Workflow

**Files:**
- Create: `src/task-reply-respond.js`
- Modify: `src/claude-service.js`

- [ ] **Step 1: Add `generateReplyResponse` to `src/claude-service.js`**

```javascript
export async function generateReplyResponse(profile, incomingMessage) {
  const systemPrompt = `You are the founder of CUE AI. 
CUE AI is an AI-powered interview practice tool that gives real-time assistance so you never get blank in an interview.

Rules:
- If they ask "What is it?" or "How it works?", explain the value prop clearly.
- If they ask about pricing or enterprise, DO NOT answer. Reply with "ESC_HUMAN".
- Be casual, supportive, and human. Max 500 chars.`;

  const userPrompt = `Contact: ${profile.name}
Headline: ${profile.headline}
Message: ${incomingMessage}`;

  return await callClaude(systemPrompt, userPrompt);
}
```

- [ ] **Step 2: Implement response task in `src/task-reply-respond.js`**

```javascript
import { generateReplyResponse } from './claude-service.js';
import { updateConnectionRecord, appendReviewQueue } from './utils/helpers.js';

export async function runReplyResponse(page) {
  // Logic to find 'replied' profiles and send AI-gen message
  // If response === 'ESC_HUMAN', mark stage: 'interested' and append to review queue
}
```

- [ ] **Step 3: Commit**
```bash
git add src/task-reply-respond.js src/claude-service.js
git commit -m "feat: add AI reply workflow and escalation"
```

---

## Sub-Project 4: Analytics Dashboard

### Task 4: Create Dashboard Server

**Files:**
- Create: `src/dashboard-server.js`
- Modify: `src/index.js`

- [ ] **Step 1: Implement Express server in `src/dashboard-server.js`**

```javascript
import express from 'express';
import { loadConnections } from './utils/helpers.js';
import path from 'path';

const app = express();
const port = 3000;

app.get('/api/stats', (req, res) => {
  const connections = loadConnections(path.join(process.cwd(), 'data', 'connections-sent.json'));
  // Aggregate stats: sent, accepted, replied, interested
  res.json({ connections });
});

app.use(express.static('public'));

export function startDashboard() {
  app.listen(port, () => console.log(`Dashboard at http://localhost:${port}`));
}
```

- [ ] **Step 2: Add `dashboard` command to `src/index.js`**

- [ ] **Step 3: Commit**
```bash
git add src/dashboard-server.js src/index.js
git commit -m "feat: add analytics dashboard server"
```
