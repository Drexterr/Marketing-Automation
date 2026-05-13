# CUE AI Outreach - Phase B: Operational Dashboard (Supervisor Mode)

## 1. Goal
Build a minimalist, high-visibility "Clean Pulse" dashboard that allows a founder to monitor system health, current actions, and capacity limits at a glance.

## 2. Dashboard Structure (The Clean Pulse)
- **Hero Header (The Heartbeat):**
  - Large status indicator: "SYSTEM ACTIVE" (Green) | "IDLE" (Yellow) | "STOPPED" (Red).
  - Current Action line: "Currently Processing: [Profile Name / Task Name]" with a smooth progress bar.
  - Large "EMERGENCY STOP" button (persistent, right-aligned).
- **Metric Grid (Capacity Counters):**
  - **Connection Budget:** Radial gauge showing `Sent / Weekly Limit` (e.g., 42/100).
  - **Message Volume:** "Replies Sent Today: [X]".
  - **AI Reliability:** "AI Success Rate: [XX]%".
  - **Safety Check:** "LinkedIn Warnings: [0]".
- **Control Strip:**
  - Simple toggle switches for each automation module: [Replies] [Follow-ups] [Connect] [Feed].
- **Compact Activity Feed:**
  - The last 5-10 critical events (e.g., "Connection Sent to [Name]", "Lead Escalated").

## 3. API Contracts (Extensions)
- `GET /api/runtime/pulse`
  - Returns: `{ status, activeTask, currentProfile, progressPercent, lastHeartbeat }`
- `GET /api/runtime/counters`
  - Returns: `{ weeklyConnections, dailyReplies, aiFailures, warnings }`
- `POST /api/runtime/modules/:module/toggle`
  - Payload: `{ enabled: boolean }`

## 4. Frontend Component Hierarchy (Next.js/React)
- `layout.tsx`: Sidebar navigation and Global Stop listener.
- `page.tsx`: The "Clean Pulse" main view.
  - `<PulseHeader />`: The Hero status and active action.
  - `<MetricGrid />`: Collection of `<CapacityCard />` components.
  - `<ModuleControls />`: Group of `<Switch />` components for tasks.
  - `<CompactFeed />`: Minimalist list of recent activity.

## 5. State Management
- **TanStack Query (React Query):** Polling `/api/runtime/pulse` every 3-5 seconds for the "live" feel without WebSocket complexity.
- **Local State:** For optimistic UI updates when toggling modules.
