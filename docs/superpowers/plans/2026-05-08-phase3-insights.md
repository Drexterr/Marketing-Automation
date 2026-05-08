# Phase 3: Insights & Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Activity Feed, Advanced Analytics Dashboard, and Rich Prompt Management for the CUE AI Operational Control Panel.

**Architecture:** Extend the Express API with analytics and log-streaming endpoints. Build Recharts-based visualizations and a Monaco-powered prompt editor in the Next.js frontend. Implement an audit logging service for system traceability.

**Tech Stack:** Next.js 15, Recharts, @monaco-editor/react, Express 5, TanStack Query.

---

### Task 1: Analytics API & Data Aggregator

**Files:**
- Modify: `backend-api/routes/state.js`
- Create: `backend-api/services/analyticsService.js`

- [ ] **Step 1: Implement Analytics Service**
```javascript
// backend-api/services/analyticsService.js
import { JsonRepository } from '../../shared/repositories/JsonRepository.js';
import { NdjsonRepository } from '../../shared/repositories/NdjsonRepository.js';
import path from 'path';

export async function getAggregatedAnalytics() {
  const connRepo = new NdjsonRepository(path.join('data', 'connections-sent.json'));
  const summaryRepo = new JsonRepository(path.join('data', 'dashboard-summary.json'));
  
  const connections = await connRepo.findAll();
  const summary = await summaryRepo.findAll();
  
  // Basic aggregation logic
  const funnel = {
    sent: connections.length,
    accepted: connections.filter(c => ['accepted', 'first_message_sent', 'replied'].includes(c.stage)).length,
    replied: connections.filter(c => ['replied', 'interested'].includes(c.stage)).length,
    interested: connections.filter(c => c.stage === 'interested').length,
  };

  return {
    ...summary,
    funnel,
    timestamp: new Date().toISOString()
  };
}
```

- [ ] **Step 2: Add Analytics Route**
```javascript
// backend-api/routes/analytics.js
import express from 'express';
import { getAggregatedAnalytics } from '../services/analyticsService.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const data = await getAggregatedAnalytics();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

- [ ] **Step 3: Register route in server.js**
Modify `backend-api/server.js` to import and use `analyticsRoutes` at `/api/analytics`.

- [ ] **Step 4: Commit**
```bash
git add backend-api/
git commit -m "feat: add analytics service and API routes"
```

---

### Task 2: Activity Feed & Log Streaming

**Files:**
- Create: `backend-api/routes/activity.js`

- [ ] **Step 1: Implement Activity Route**
```javascript
// backend-api/routes/activity.js
import express from 'express';
import { NdjsonRepository } from '../../shared/repositories/NdjsonRepository.js';
import path from 'path';

const router = express.Router();

router.get('/', async (req, res) => {
  const activityRepo = new NdjsonRepository(path.join('data', 'activity.ndjson'));
  const activities = await activityRepo.findAll();
  // Return last 50 events, reversed (newest first)
  res.json(activities.slice(-50).reverse());
});

export default router;
```

- [ ] **Step 2: Register route in server.js**
Modify `backend-api/server.js` to register `activityRoutes` at `/api/activity`.

- [ ] **Step 3: Commit**
```bash
git add backend-api/routes/activity.js backend-api/server.js
git commit -m "feat: add activity feed API endpoint"
```

---

### Task 3: Audit Logger Service

**Files:**
- Create: `backend-api/services/auditService.js`
- Modify: `backend-api/routes/auth.js`
- Modify: `backend-api/routes/state.js`

- [ ] **Step 1: Implement Audit Service**
```javascript
// backend-api/services/auditService.js
import { NdjsonRepository } from '../../shared/repositories/NdjsonRepository.js';
import path from 'path';

const auditRepo = new NdjsonRepository(path.join('data', 'audit.ndjson'));

export async function logAudit(action, details) {
  await auditRepo.create({
    timestamp: new Date().toISOString(),
    action,
    details
  });
}
```

- [ ] **Step 2: Log critical actions**
Add `logAudit` calls to:
- `POST /api/auth/login`
- `POST /api/toggle/:module` (in Phase 2 routes if they exist, or wait for integration)

- [ ] **Step 3: Commit**
```bash
git add backend-api/
git commit -m "feat: add audit logging service"
```

---

### Task 4: Dashboard Analytics & Feed UI

**Files:**
- Create: `frontend/components/dashboard/analytics-charts.tsx`
- Create: `frontend/components/dashboard/activity-feed.tsx`
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Install Recharts**
Run: `cd frontend && npm install recharts`

- [ ] **Step 2: Implement AnalyticsCharts component**
Use `ResponsiveContainer`, `LineChart`, `BarChart` from Recharts.

- [ ] **Step 3: Implement ActivityFeed component**
Create a scrollable list of activity items with icons per type.

- [ ] **Step 4: Update Dashboard page**
Integrate `AnalyticsCharts` and `ActivityFeed` into the `frontend/app/page.tsx`.

- [ ] **Step 5: Commit**
```bash
git add frontend/
git commit -m "feat: add analytics charts and activity feed to dashboard"
```

---

### Task 5: Prompt Management with Monaco Editor

**Files:**
- Create: `backend-api/routes/prompts.js`
- Create: `frontend/app/prompts/page.tsx`

- [ ] **Step 1: Install Monaco Editor**
Run: `cd frontend && npm install @monaco-editor/react`

- [ ] **Step 2: Implement Prompts API**
Endpoints `GET /api/prompts` and `POST /api/prompts` (with JSON validation and audit logging).

- [ ] **Step 3: Implement Prompts Page**
A full-screen editor layout using `@monaco-editor/react`.

- [ ] **Step 4: Commit**
```bash
git add backend-api/ frontend/
git commit -m "feat: implement rich prompt management with Monaco editor"
```
