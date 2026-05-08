# Design Spec: CUE AI Operational Control Panel - Phase 2 (Core Control UI)

**Date:** 2026-05-08
**Topic:** Core Control UI (Phase 2)
**Status:** Approved

## 1. Overview
Phase 2 focuses on building the frontend dashboard for the CUE AI Operational Control Panel. Using Next.js 15, Tailwind CSS, and shadcn/ui, we will create a modern, high-information-density UI to monitor and control the automation workflows established in Phase 1.

## 2. Technology Stack
- **Framework:** Next.js 15 (App Router).
- **Styling:** Tailwind CSS + Vanilla CSS for custom animations.
- **Components:** shadcn/ui (Radix UI primitives).
- **Icons:** Lucide React.
- **Data Fetching:** React Query (TanStack Query) for robust API synchronization.
- **Animations:** Framer Motion for subtle transitions and "pulse" effects.

## 3. Layout & Global Navigation
The UI will adopt a **Sidebar Navigation** layout for efficient access to multi-page modules:
- **Sidebar (Global):**
  - **Status Indicator:** A real-time pulsing badge indicating automation state (Running, Idle, Sleeping, Error).
  - **Emergency Stop:** A globally accessible, high-priority red button to instantly halt all processes.
  - **Navigation:** Links to Overview, Automation, Inbox (Phase 4), Analytics (Phase 3), and Settings.

## 4. Key Pages & Features
### 4.1 Automation Control Page
- **Module Toggles:** Individual switches for Connections, First Messages, Reply Monitoring, Auto-replies, Feed Comments, and Content Posting.
- **Persistence:** Toggle states are synced immediately via the `/api/toggle` endpoints to `data/system-config.json`.
- **Scheduler Controls:** Controls for active run windows and daily limits.

### 4.2 Overview Dashboard (Landing Page)
- **Status Cards:** Real-time metrics and state summaries.
- **Alert System:** Visual notifications for critical system events (e.g., LinkedIn warnings, Session expirations).

## 5. Implementation Strategy
- **Client-Side Data:** Use React Query hooks to poll `/api/state` for real-time status.
- **Optimistic UI:** Implement optimistic updates for toggles to ensure the UI feels snappy (Vercel/Linear-like).
- **Dark Mode First:** Modern SaaS aesthetic with a dark-mode-first design.

## 6. Testing & Validation
- **Component Tests:** Verify individual UI components (toggles, status badges) render correctly.
- **Integration Tests:** Verify that toggling a UI switch correctly updates the backend configuration file.
- **Visual Regression:** Ensure layout consistency across different screen sizes.
