# CUE AI — LinkedIn Outreach Automation

Automated LinkedIn outreach for [CUE AI](https://cueai.in) — a stealth Electron overlay that transcribes system audio and injects real-time interview prompts into AI chat interfaces.

The bot finds software engineers who are actively job hunting in India, scores their profiles with Claude AI, sends personalized connection requests, follows up with first messages, reads replies, and responds — all with human-like timing and behavior.

**No Anthropic API key required.** Uses the Claude CLI or claude.ai website with your existing subscription.

---

## What It Does

| Task | What happens |
|------|-------------|
| `connect` | Searches LinkedIn for target keywords → Claude scores each profile → sends a personalized connection note to anyone scoring 7+ |
| `first-message` | Detects newly accepted connections → Claude writes a casual opener → sends it with human-like typing |
| `replies` | Scans unread inbox threads → detects high-intent keywords → flags hot leads |
| `replies` (auto-respond) | Claude reads the last message → writes a reply → sends it, or escalates to you if it's about pricing/bugs/complaints |
| `feed` | Scrolls your feed → Claude judges post relevance → posts a specific 1–2 sentence comment |
| `followups` | Marks connections who went silent after 5 days as eligible for a follow-up |
| `post` | Drafts and publishes a LinkedIn post on Tue/Thu (opt-in via `ENABLE_AUTO_POST=true`) |
| `analytics` | Exports a full funnel summary to `data/dashboard-summary.json` |
| `dashboard` | Starts a local web server at `http://localhost:3000` showing live funnel stats |
| `schedule` | Runs all tasks on a daily loop at ~9am with randomized ±45 min offset |

---

## Prerequisites

- **Node.js 18+** — [download](https://nodejs.org)
- **Claude CLI** (recommended) or a **claude.ai account** (web mode)
- A LinkedIn account

---

## Installation

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright's Chromium browser
npx playwright install chromium

# 3. Copy the env file
cp .env .env.backup   # back up your current .env if it exists
```

---

## Configuration

Open `.env` and fill in every field:

```bash
# LinkedIn account credentials
LINKEDIN_EMAIL=you@email.com
LINKEDIN_PASSWORD=yourpassword

# How Claude AI is invoked — cli or web (no API key needed)
CLAUDE_MODE=cli

# Your identity — injected into every Claude prompt
FOUNDER_NAME=Raghu
PRODUCT_NAME=CUE AI
PRODUCT_DESCRIPTION=A stealthy Electron overlay that listens to system audio during interviews, transcribes speech in real time, and injects suggested answers into AI chat interfaces so candidates never blank out.

# Safety limits
WEEKLY_CONNECTION_LIMIT=5        # start low, increase after first dry run
HEADLESS=false                   # keep false until session is saved
ENABLE_AUTO_POST=false           # set true only when you want auto LinkedIn posts
```

The target audience, keywords, and scoring tiers are already configured in `.env` for CUE AI's ICP. See [TARGET-AUDIENCE.md](TARGET-AUDIENCE.md) to understand or change them.

---

## First-Time Setup

### Step 1 — Set up Claude (choose one)

**Option A: CLI (recommended)**

```bash
# Install the Claude CLI
npm install -g @anthropic-ai/claude-code

# Log in once — opens a browser window
claude login

# Verify it works
claude -p "say hello"
```

Set `CLAUDE_MODE=cli` in `.env`.

**Option B: Web (claude.ai)**

Set `CLAUDE_MODE=web` in `.env`. On the first run a Chromium window opens on claude.ai — log in manually. The session is saved to `data/claude-session.json` for all future runs.

---

### Step 2 — Log in to LinkedIn

```bash
npm run setup
```

This opens a visible Chrome window on the LinkedIn login page. Log in manually. Solve any CAPTCHA yourself. Once you reach the feed, the session is saved to `data/session.json` and the window closes. You won't need to log in again unless the session expires.

---

### Step 3 — Dry run (5 connections)

Make sure `WEEKLY_CONNECTION_LIMIT=5` is set in `.env`, then:

```bash
node src/index.js connect
```

Open `data/connections-sent.json` when it finishes. Check:
- Are the profiles the right people? (job-hunting engineers, fresh grads, bootcamp graduates)
- Do the connection notes sound human and specific?

If profiles are off, adjust `TARGET_KEYWORDS` in `.env`. If notes are off, edit the prompt in `src/claude-service.js` → `generateConnectionNote()`.

Once satisfied, increase the limit and run normally.

---

## Running Tasks

```bash
node src/index.js <command>
```

| Command | When to run | What it does |
|---------|-------------|-------------|
| `setup` | Once | Log in to LinkedIn, save session |
| `connect` | Mon / Wed / Fri | Find and send connection requests |
| `first-message` | Tue / Thu | Message people who accepted your request |
| `replies` | Daily | Scan inbox, auto-respond or escalate |
| `followups` | Every 3 days | Mark silent contacts as eligible for follow-up |
| `feed` | Mon / Wed / Fri | Comment on relevant posts |
| `post` | Automatic (Tue / Thu) | Publish a LinkedIn post (only if `ENABLE_AUTO_POST=true`) |
| `analytics` | Weekly | Export funnel metrics to JSON |
| `dashboard` | Anytime | Open `http://localhost:3000` for live stats |
| `schedule` | Leave running | Runs the full daily cycle automatically at ~9am |

### Run everything automatically

```bash
node src/index.js schedule
```

Runs all tasks once per day at approximately 9am with a random ±45 minute offset (so it never fires at exactly the same time). Keeps running in a loop — leave this process alive.

---

## Data Files

Everything is stored in plain text NDJSON files in `data/`. You can open them in any editor.

```
data/
├── connections-sent.json     Every profile: name, score, note, current stage, timestamps
├── comments-sent.json        Every post commented on + the generated comment
├── review-queue.ndjson       Hot leads and security warnings flagged for your attention
├── session-summary.ndjson    Per-run stats (sent, failed, limit hits)
├── dashboard-summary.json    Latest funnel metrics
├── session.json              LinkedIn session cookies (never commit)
├── claude-session.json       Claude.ai session cookies — web mode only (never commit)
└── system-state.json         Week counter, last run time, next scheduled run
```

### Connection stages

Each contact in `connections-sent.json` moves through these stages:

```
request_sent → connected → first_message_sent → followup_eligible → replied → conversation_active → interested
```

`ESC_HUMAN` replies skip directly to `interested` and appear in `review-queue.ndjson` with a Slack alert.

---

## Safety Limits

These are built in and cannot be bypassed:

| Limit | Value | Where |
|-------|-------|-------|
| Daily connection cap | 8 | `task-connect.js` |
| Weekly cap (week 1) | 25 | Auto-increases each week |
| Weekly cap (week 5+) | 50 | Max plateau |
| Delay between connections | 8–25 sec random | `helpers.js` |
| Delay between messages | 12–25 sec random | `task-first-message.js` |
| Delay between comments | 60–120 sec random | `task-feed.js` |
| Max comments per feed session | 3 | `index.js` |
| Auto-post days | Tue + Thu only | `task-post-content.js` |

If LinkedIn shows a CAPTCHA, login challenge, or account restriction, the bot pauses immediately, writes a `safety_warning` to `data/review-queue.ndjson`, and sends a Slack alert if `SLACK_WEBHOOK_URL` is configured.

---

## Slack Alerts

Add `SLACK_WEBHOOK_URL` to `.env` to get notified when:
- A hot lead replies (pricing, demo, "interested", "tell me more")
- The bot detects a CAPTCHA or account restriction
- AI escalates a conversation to human review

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz
```

---

## Recommended Weekly Schedule

| Day | Commands to run |
|-----|----------------|
| Monday | `connect`, `feed`, `replies` |
| Tuesday | `first-message`, `replies` |
| Wednesday | `connect`, `feed`, `replies` |
| Thursday | `first-message`, `replies` |
| Friday | `connect`, `feed`, `replies`, `followups` |
| Any day | `analytics` to check funnel numbers |

Or just run `node src/index.js schedule` and let it handle the timing automatically.

---

## Troubleshooting

**LinkedIn session expired**
Delete `data/session.json` and run `npm run setup` again.

**Claude CLI not found**
```bash
npm install -g @anthropic-ai/claude-code
claude login
```

**Claude web mode stuck on login**
Delete `data/claude-session.json`. On next run, log in manually in the browser window that opens.

**Profiles being found are wrong audience**
Edit `TARGET_KEYWORDS` in `.env`. After changing, run `connect` again with `WEEKLY_CONNECTION_LIMIT=5` and check the output.

**Connection notes sound generic**
Edit the `generateConnectionNote()` prompt in `src/claude-service.js`. Add a few example notes in the prompt using real profiles as few-shot examples.

**LinkedIn DOM selectors broken**
LinkedIn updates its HTML periodically. When a task stops finding buttons or elements, check `logs/automation.log` for which selector failed, then update it in the relevant task file (`task-connect.js`, `task-feed.js`, etc). Selectors are near the top of each file.

---

## Project Structure

```
├── src/
│   ├── index.js                CLI entry point — all commands live here
│   ├── browser.js              Playwright launcher with session persistence and stealth
│   ├── claude-service.js       All AI prompt functions — routes to CLI or web
│   ├── scheduler.js            Daily loop runner with randomized timing
│   ├── analytics.js            Funnel metrics aggregator
│   ├── dashboard-server.js     Express API + static server for local dashboard
│   ├── task-connect.js         Search → score → send connection requests
│   ├── task-first-message.js   Detect acceptances → send opening message
│   ├── task-reply-check.js     Scan inbox → detect intent → flag hot leads
│   ├── task-reply-respond.js   Generate AI reply → send or escalate to human
│   ├── task-followups.js       Mark 5-day-silent contacts as follow-up eligible
│   ├── task-feed.js            Scroll feed → score relevance → comment
│   ├── task-post-content.js    Draft and publish LinkedIn posts (opt-in)
│   └── utils/
│       ├── logger.js           Winston logger (file + console)
│       ├── helpers.js          NDJSON storage, rate limit checks, delays
│       ├── alerts.js           Slack webhook sender
│       ├── claude-cli.js       Spawns `claude -p "..."` and captures output
│       └── claude-web.js       Playwright client for claude.ai
├── data/                       Auto-created on first run (gitignored)
├── logs/                       Auto-created on first run
├── .env                        Your credentials and config (never commit)
├── README.md                   This file
├── CLAUDE-MODES.md             How CLI and web modes work
└── TARGET-AUDIENCE.md          Full ICP definition and scoring logic
```

---

## Other Docs

- [CLAUDE-MODES.md](CLAUDE-MODES.md) — How prompts are built and sent to Claude, how both modes work, troubleshooting
- [TARGET-AUDIENCE.md](TARGET-AUDIENCE.md) — Full ICP breakdown, scoring tiers, who to exclude, the core user picture
- [plan.md](plan.md) — Original roadmap and architecture decisions
