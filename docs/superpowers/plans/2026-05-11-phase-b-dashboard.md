# Phase B: Operational Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a minimalist "Clean Pulse" supervisor dashboard for real-time monitoring of active tasks and capacity limits.

**Architecture:** Extend `RuntimeStateService` for pulse tracking, create dedicated Express endpoints for runtime data, and build a polling React dashboard focused on high-visibility status and metrics.

**Tech Stack:** React (Next.js), Tailwind CSS, lucide-react, TanStack Query, Express.js, better-sqlite3.

---

### Task 1: RuntimeStateService Pulse Support

**Files:**
- Modify: `backend-api/services/RuntimeStateService.js`
- Test: `backend-api/services/RuntimeStateService.test.js`

- [ ] **Step 1: Write the failing test for pulse tracking**

```javascript
// backend-api/services/RuntimeStateService.test.js
import { RuntimeStateService } from './RuntimeStateService.js';
import assert from 'node:assert';
import test from 'node:test';

test('RuntimeStateService handles pulse data', () => {
    const pulse = { status: 'ACTIVE', activeTask: 'task-connect', progressPercent: 50 };
    RuntimeStateService.setPulse(pulse);
    const retrieved = RuntimeStateService.getPulse();
    assert.deepStrictEqual(retrieved, pulse);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test backend-api/services/RuntimeStateService.test.js`
Expected: FAIL (setPulse is not a function)

- [ ] **Step 3: Implement setPulse and getPulse**

```javascript
// backend-api/services/RuntimeStateService.js
export const RuntimeStateService = {
    // ... existing
    setPulse: (data) => repo.set('runtime_pulse', { ...data, lastHeartbeat: new Date().toISOString() }),
    getPulse: () => repo.get('runtime_pulse') || { status: 'IDLE', activeTask: null },
    // ...
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test backend-api/services/RuntimeStateService.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend-api/services/RuntimeStateService.js
git commit -m "feat: add pulse tracking to RuntimeStateService"
```

---

### Task 2: Backend API Endpoints (Pulse & Counters)

**Files:**
- Create: `backend-api/routes/runtime.js`
- Modify: `backend-api/server.js`

- [ ] **Step 1: Create runtime route for pulse and counters**

```javascript
// backend-api/routes/runtime.js
import express from 'express';
import { RuntimeStateService } from '../services/RuntimeStateService.js';
import { ConnectionRepository } from '../../shared/repositories/ConnectionRepository.js';

const router = express.Router();
const connRepo = new ConnectionRepository();

router.get('/pulse', (req, res) => {
    res.json(RuntimeStateService.getPulse());
});

router.get('/counters', (req, res) => {
    res.json({
        weeklyConnections: connRepo.countSentInLast7Days(),
        dailyReplies: 0, // Placeholder until activity log migration
        aiFailures: 0,
        warnings: 0
    });
});

export default router;
```

- [ ] **Step 2: Mount route in server.js**

```javascript
// backend-api/server.js
import runtimeRouter from './routes/runtime.js';
// ...
app.use('/api/runtime', runtimeRouter);
```

- [ ] **Step 3: Verify endpoints manually or with a simple script**

Run: `curl http://localhost:3000/api/runtime/pulse`
Expected: JSON response with status: 'IDLE'

- [ ] **Step 4: Commit**

```bash
git add backend-api/routes/runtime.js backend-api/server.js
git commit -m "feat: add /api/runtime/pulse and /api/runtime/counters endpoints"
```

---

### Task 3: Scheduler Integration (Pushing Pulse)

**Files:**
- Modify: `src/scheduler.js`

- [ ] **Step 1: Update scheduler to push active task state**

```javascript
// src/scheduler.js
// ... inside runScheduler loop
RuntimeStateService.setPulse({ status: 'ACTIVE', activeTask: task.name });
try {
    await task();
} finally {
    RuntimeStateService.setPulse({ status: 'ACTIVE', activeTask: 'WAITING' });
}
```

- [ ] **Step 2: Update task names if anonymous**

Ensure workflows passed to `runScheduler` have identifiable names or update the call site.

- [ ] **Step 3: Commit**

```bash
git add src/scheduler.js
git commit -m "feat: scheduler pushes pulse updates to runtime state"
```

---

### Task 4: Frontend "Clean Pulse" Hero

**Files:**
- Create: `frontend/components/dashboard/PulseHeader.tsx`
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Implement PulseHeader component**

```tsx
// frontend/components/dashboard/PulseHeader.tsx
import { Zap, Activity, ShieldAlert } from 'lucide-react';

export function PulseHeader({ pulse }: { pulse: any }) {
    const statusColor = pulse.status === 'ACTIVE' ? 'bg-green-500' : 'bg-yellow-500';
    return (
        <div className="bg-card p-8 rounded-3xl border shadow-sm space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={`w-4 h-4 rounded-full animate-pulse ${statusColor}`} />
                    <h2 className="text-2xl font-bold tracking-tight">
                        SYSTEM {pulse.status}
                    </h2>
                </div>
                <button className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl transition-colors">
                    EMERGENCY STOP
                </button>
            </div>
            <div className="space-y-2">
                <p className="text-muted-foreground font-medium">Currently: {pulse.activeTask || 'Resting'}</p>
                <div className="w-full bg-secondary h-3 rounded-full overflow-hidden">
                    <div className="bg-primary h-full transition-all duration-500" style={{ width: `${pulse.progressPercent || 0}%` }} />
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Update page.tsx to poll and show PulseHeader**

```tsx
// frontend/app/page.tsx
const { data: pulse } = useQuery({ 
    queryKey: ['pulse'], 
    queryFn: () => fetch('/api/runtime/pulse').then(res => res.json()),
    refetchInterval: 3000
});
// Render <PulseHeader pulse={pulse} />
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/dashboard/PulseHeader.tsx frontend/app/page.tsx
git commit -m "feat: implement frontend PulseHeader with real-time polling"
```

---

### Task 5: MetricGrid & ModuleControls

**Files:**
- Create: `frontend/components/dashboard/MetricGrid.tsx`
- Create: `frontend/components/dashboard/ModuleControls.tsx`

- [ ] **Step 1: Implement MetricGrid with capacity gauges**
- [ ] **Step 2: Implement ModuleControls with toggles**
- [ ] **Step 3: Update page.tsx to include these components**
- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: complete Clean Pulse dashboard metrics and controls"
```
