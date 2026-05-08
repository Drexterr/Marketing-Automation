# Phase 4 Completion Design — CUE AI LinkedIn Automation

**Date:** 2026-05-07
**Status:** Approved
**Topic:** Implementation of missing production features (Scheduler, Follow-ups, AI Reply, Deep Scraping, Analytics)

---

## 1. Overview
This specification covers the final phase of the LinkedIn automation platform. The primary goal is to transition from manual task triggers to a fully autonomous, production-safe system that targets tech freshers and job seekers with CUE AI's value proposition: "AI-powered interview practice / Never get blank in an interview."

## 2. Architecture & Components

### 2.1 Cron Scheduler Orchestration (`src/scheduler.js`)
- **CLI Command:** `node src/index.js schedule`
- **Execution Flow:** Sequential execution of:
    1. `reply-check` (Detect new messages)
    2. `reply-respond` (NEW: AI-assisted responses)
    3. `followups` (NEW: Send pending follow-ups)
    4. `connect` (Outreach with Deep Scraping)
    5. `feed` (Engagement)
    6. `analytics` (Summary generation)
- **Randomization:** 
    - Daily window start time ±45 minutes.
    - Workflow gaps: 2–10 minutes.
    - Persist `nextRun` in `data/system-state.json` to prevent skip-loops.
- **Safety:** Abort all tasks if CAPTCHA, restricted account, or session invalidation is detected.

### 2.2 AI Reply & Follow-up System
- **Task:** `src/task-reply-respond.js`
- **Hybrid Logic:**
    - **Auto-Reply:** Claude answers "What is it?" or "How does it work?" using CUE AI knowledge base.
    - **Escalation:** Pricing, enterprise inquiries, legal, or complex technical bugs are marked as `interested` and added to `review-queue.ndjson`.
- **Follow-up Rules:**
    - Max 2 follow-ups if no reply.
    - Follow-up #1 (T+5 days): Light re-engagement.
    - Follow-up #2 (T+10 days): Polite close-loop.
    - State transitions: `first_message_sent` → `followup_eligible` → `followup_sent_1` → `followup_sent_2`.

### 2.3 Deep Profile Scraping
- **Targeting:** Tech freshers, "Open to Work" individuals, and job switchers.
- **Logic:**
    - Perform initial headline scan in search results.
    - Profiles matching keywords (fresher, seeking, looking) or tech titles trigger a full visit.
    - Extract: "About" section, "Open to Work" badge status, and top 2 recent posts/activity.
    - Use extracted data for scoring (Claude) and personalized note generation.
- **Limit:** Max 20–40 seconds per profile visit to simulate human reading.

### 2.4 Analytics Web Dashboard (`src/dashboard-server.js`)
- **CLI Command:** `node src/index.js dashboard`
- **Stack:** Express.js + Chart.js (static JS).
- **Features:**
    - Funnel visualization (Sent → Accepted → Replied → Interested).
    - Conversion rates (Acceptance %, Reply %, Interest %).
    - A/B Test monitoring (Variant A vs B performance).
    - Read-only access to `data/*.json` and `data/*.ndjson`.

### 2.5 A/B Message Testing
- **Implementation:** Randomly assign `variant: "A"` or `variant: "B"` to new connections.
- **Claude Support:** Generate two different styles (e.g., "Direct/Utility-first" vs "Social/Support-first").
- **Tracking:** Metrics aggregated per variant in the dashboard.

### 2.6 Content & Alerts
- **Auto-Post:** 2x/week (Tue/Thu) generating content about "Interview anxiety", "FAANG prep", and "CUE AI updates".
- **Slack Alerts:** Notify on `high_intent_reply`, `captcha_detected`, or `session_invalidated`.

## 3. Data Schema Updates

### 3.1 `system-state.json`
```json
{
  "nextScheduledRun": "2026-05-08T09:15:00Z",
  "lastCompletedRun": "2026-05-07T09:00:00Z",
  "enableAutoPost": true,
  "enableAutoReply": true
}
```

### 3.2 `connections-sent.json` (Entry Update)
```json
{
  "variant": "A",
  "about": "...",
  "isOpenToWork": true,
  "followUpCount": 1,
  "lastFollowUpAt": "2026-05-07T..."
}
```

## 4. Safety & Compliance
- Maintain existing 100 connections/week limit.
- Respect daily caps (8–12 requests/day).
- All AI replies are capped at 500 characters.
- NO autonomous sales-closing or booking; human must handle final conversion.
