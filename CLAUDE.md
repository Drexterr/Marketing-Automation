# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

LinkedIn outreach automation for CUE AI (an Electron interview-assist overlay). Uses Playwright to drive a Chromium browser on LinkedIn and Claude AI to score profiles, generate personalized messages, and decide which posts to comment on.

## Commands

```bash
# Install dependencies and Playwright browser
npm install && npx playwright install chromium

# Copy and fill in credentials
cp .env.example .env

# Run individual tasks
npm run connect      # Send connection requests (respects 100/week limit)
npm run messages     # Reply to unread conversations
npm run feed         # Scroll feed and comment on relevant posts

# Run all tasks sequentially
node index.js all

# Run on cron schedule (default: Monday 9am)
node index.js schedule
node index.js schedule --cron "0 9 * * 1,3,5"
```

There are no tests or a linter configured.

## Architecture

All source files are at the repo root (not in `src/`):

| File | Role |
|------|------|
| `index.js` | CLI entry point (Commander.js), cron scheduler via `node-cron` |
| `browser.js` | `LinkedInBrowser` class — Playwright launch, session persistence, stealth, human delays |
| `claude-service.js` | All Anthropic API calls — profile evaluation, note/message/comment generation |
| `task-connect.js` | Search → evaluate → send connection requests |
| `task-messages.js` | Read unread conversations → generate → type replies |
| `task-feed.js` | Scroll feed → score posts → comment |

### Data flow

Each task creates its own `LinkedInBrowser` instance, calls `browser.launch()` + `browser.login()`, then uses `claude-service.js` for AI decisions. State is persisted in `data/*.json` files (auto-created). Session cookies are saved to `data/session.json` after first login.

### Claude model in use

`claude-service.js` uses `claude-sonnet-4-20250514`. All five exported functions follow the same pattern: build a prompt string using `PRODUCT_CONTEXT` (from `.env`), call `client.messages.create()`, return parsed text or JSON.

## Key Env Vars

```
LINKEDIN_EMAIL / LINKEDIN_PASSWORD
ANTHROPIC_API_KEY
WEEKLY_CONNECTION_LIMIT   # default 100
HEADLESS                  # false = visible browser (needed for first run / CAPTCHA)
SLOW_MO                   # ms between Playwright actions
FOUNDER_NAME / FOUNDER_ROLE / PRODUCT_NAME / PRODUCT_DESCRIPTION   # injected into every Claude prompt
TARGET_KEYWORDS           # comma-separated search terms for connect task
```

## LinkedIn DOM Selectors

Selectors are embedded inline in each task file (not abstracted). They break when LinkedIn updates its DOM — keep them near the top of each file so they're easy to spot and fix. Key selectors:

- Profile cards: `.search-results-container .entity-result`
- Connect button: `button:has-text("Connect")`
- Add note button: `button:has-text("Add a note")`
- Note textarea: `#custom-message, textarea[name="message"]`

## Safety Constraints

- Hard weekly cap of 100 connections (tracked in `data/connections-sent.json`, resets every 7 days)
- Random delays: 5–12s between connections, 15–30s between comments
- Max 10 comments per feed session
- Character-by-character typing simulation for human-like input
- `data/session.json` and `.env` must never be committed

## Prompt Tuning

All AI prompts live in `claude-service.js`. To improve quality:
- Add few-shot examples inside `generateConnectionNote()` or `generateFirstMessage()`
- Adjust the scoring rubric in `evaluateConnectionTarget()` (negative signals lower the score)
- Modify `PRODUCT_CONTEXT` via `.env` vars — this block is prepended to every prompt
