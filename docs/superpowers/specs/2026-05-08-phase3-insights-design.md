# Design Spec: CUE AI Operational Control Panel - Phase 3 (Insights & Management)

**Date:** 2026-05-08
**Topic:** Insights & Management (Phase 3)
**Status:** Approved

## 1. Overview
Phase 3 focuses on the "Intelligence" and "Configuration" layers of the dashboard. This includes visualizing deep funnel analytics, providing a real-time operational timeline (Activity Feed), and establishing a professional-grade editor for AI prompt management.

## 2. Integrated Insights Hub (Dashboard)
We will unify data and activity into a single "Command Center" view.

- **Advanced Analytics (Recharts):**
  - **Funnel Visualization:** A dedicated component to show the drop-off from connection requests to high-intent replies.
  - **Performance Segmentation:** Dynamic bar charts comparing success rates across different LinkedIn campaigns and target keywords.
  - **AI Quality Tracking:** Line charts showing the average "Claude Score" and reply latency over time.
- **Operational Timeline (Activity Feed):**
  - **Infinite Scroll:** A performant stream of events fetched from append-only NDJSON logs.
  - **Event Cards:** Rich cards for different event types (Connection, Message, Comment, Safety Warning).
  - **Real-time Updates:** React Query polling to ensure the feed stays current.

## 3. Prompt Management
- **Rich Editor Interface:** Integration of a Monaco-style code editor for editing prompt templates.
- **Template Schema:** Centralized JSON storage in `data/prompts.json` covering:
  - Connection request templates.
  - First message variants.
  - Auto-reply logic.
  - Feed comment personas.
- **Safety Checks:** Validation to ensure prompts don't exceed character limits or break JSON formatting before saving.

## 4. Audit Logging & System Integrity
- **Audit Trail:** An append-only `data/audit.ndjson` recording:
  - **User Actions:** Manual toggle changes, prompt edits, and system stops.
  - **System Events:** Automation restarts, Claude API failures, and LinkedIn safety triggers.
- **Architecture:** A middleware-like service in the backend that intercepts state changes and records them for traceability.

## 5. API Design
- **`GET /api/analytics`**: Computes and returns aggregated metrics for the dashboard charts.
- **`GET /api/activity`**: Returns a paginated list of system events.
- **`GET /api/prompts`**: Retrieves current prompt templates.
- **`POST /api/prompts`**: Updates templates and records an audit entry.

## 6. Testing & Validation
- **Data Accuracy:** Unit tests to verify that the analytics aggregator correctly parses existing `connections-sent.json` data.
- **Editor Reliability:** Verify that invalid JSON in the prompt editor is caught and prevented from saving.
- **Performance:** Ensure the activity feed remains responsive even with thousands of log entries.
