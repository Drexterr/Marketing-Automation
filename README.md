# CUE AI — LinkedIn Automation Bot

Playwright + Claude AI powered LinkedIn automation for the CUE AI founder. Automates connection requests, message replies, and feed engagement — all personalized via Claude AI.

---

## Features

| Task | What it does |
|------|-------------|
| **Connect** | Searches target profiles, asks Claude if they're a fit, generates personalized connection notes, sends up to 100/week |
| **Messages** | Reads unread conversations, generates AI-personalized replies, types them naturally |
| **Feed** | Scrolls the feed, Claude scores each post, generates relevant comments for high-value posts |

---

## Setup

### 1. Install

```bash
cd linkedin-automation
npm run setup
```

This will:
- Ask for your LinkedIn credentials and Anthropic API key
- Install dependencies
- Install Playwright's Chromium browser

### 2. Manual install (alternative)

```bash
npm install
npx playwright install chromium
cp .env.example .env
# Edit .env with your credentials
```

---

## Usage

```bash
# Send connection requests (respects 100/week limit)
npm run connect

# Check and reply to unread messages
npm run messages

# Scroll feed and comment on relevant posts
npm run feed

# Run all tasks at once
node src/index.js all

# Run on weekly schedule (every Monday 9am by default)
node src/index.js schedule

# Custom cron schedule
node src/index.js schedule --cron "0 9 * * 1"
```

---

## Configuration (`.env`)

```env
# LinkedIn
LINKEDIN_EMAIL=you@example.com
LINKEDIN_PASSWORD=yourpassword

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Limits
WEEKLY_CONNECTION_LIMIT=100    # LinkedIn's safe limit
HEADLESS=false                  # false = visible browser
SLOW_MO=50                     # ms between actions (human-like)

# Your identity (used in AI prompts)
FOUNDER_NAME=Your Name
PRODUCT_NAME=CUE AI
PRODUCT_DESCRIPTION=...

# Cron: every Monday at 9am
CRON_SCHEDULE=0 9 * * 1
```

---

## How It Works

### Connection Task
1. Searches LinkedIn for target keywords (engineers, PMs, recruiters, etc.)
2. For each profile, sends the name/headline to Claude for a fit score (1-10)
3. Profiles scoring ≥6 get a personalized connection note (Claude-generated)
4. Bot clicks Connect → Add a note → fills in note → sends
5. Stops at weekly limit (default: 100)

### Messages Task
1. Opens LinkedIn Messaging
2. For each unread conversation, extracts message history
3. Sends history to Claude → gets a personalized reply
4. Types reply naturally (character by character with random delays)
5. Tracks replied conversations to avoid duplicates

### Feed Task
1. Scrolls the LinkedIn feed
2. For each post, sends author + content to Claude for scoring
3. Posts scoring ≥6 get a genuine, insightful comment (not forced CUE AI promo)
4. Submits comment
5. Max 10 comments per session, 15-30s between comments

---

## Data Files

```
data/
  connections-sent.json   # Profiles contacted + weekly counter
  messages-sent.json      # Conversations replied to
  comments-sent.json      # Posts commented on
  session.json            # LinkedIn browser session (auto-saved)
logs/
  automation.log          # Full activity log
```

---

## Safety & Limits

- **100 connections/week** — LinkedIn's safe limit (resets every 7 days)
- **10 comments/session** — Spread over time to avoid spam detection
- **Random delays** — 5-15s between connections, 15-30s between comments
- **Human typing** — Character-by-character with random delays
- **Session persistence** — Saves cookies to avoid repeated logins
- **Stealth mode** — Removes `navigator.webdriver` flag

---

## First Run Tips

1. Set `HEADLESS=false` initially — LinkedIn may require a verification challenge
2. Complete any CAPTCHA or email verification manually in the browser
3. After first successful login, session is saved and subsequent runs are faster
4. Monitor `logs/automation.log` to track activity

---

## ⚠️ Disclaimer

This tool automates actions on LinkedIn. Use responsibly:
- Stay within LinkedIn's Terms of Service
- Don't set limits higher than LinkedIn allows (100 connections/week)
- Avoid running 24/7 — use scheduled weekly runs
- The `SLOW_MO` and random delays are designed to mimic human behavior
