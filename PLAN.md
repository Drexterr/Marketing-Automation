# CUE AI — LinkedIn Automation: Implementation Plan & Roadmap

> Playwright + Claude AI outreach automation for CUE AI — a stealthy Electron overlay that transcribes system audio and injects interview prompts into AI chat interfaces.

---

## Overview

| Metric | Value |
|--------|-------|
| Phases | 4 |
| Time to full automation | ~6 weeks |
| Max connections per week | 100 (LinkedIn safe limit) |
| Claude AI touchpoints | 3 (profile scoring, message gen, comment gen) |

---

## Architecture Flow

```
Playwright (Chromium)  →  Claude AI (Sonnet 4)  →  LinkedIn
   Session persistence      Profile scoring          Connect
   Stealth mode             Note generation          Message
   Human delays             Reply writing            Feed
   DOM interaction          Comment writing          Data logs
```

---

## Phase 1 — Foundation & Setup (Days 1–3)

**Goal:** Get the bot running locally with a verified LinkedIn session.

- [ ] Install Node.js 18+ and run `npm install`
- [ ] Run `npm run setup` (interactive credential wizard)
- [ ] Fill in `.env` — LinkedIn credentials + Anthropic API key
- [ ] First manual login with `HEADLESS=false` to handle any verification
- [ ] Confirm `data/session.json` is saved after login
- [ ] Verify Anthropic API key works with a test call
- [ ] Check `logs/automation.log` is being written

---

## Phase 2 — Dry Run Validation (Days 4–7)

**Goal:** Validate quality of Claude's decisions before scaling.

- [ ] Run connect task with `WEEKLY_CONNECTION_LIMIT=5`
- [ ] Open `data/connections-sent.json` — review profile scores Claude assigned
- [ ] Read generated connection notes — do they sound human?
- [ ] Tune `TARGET_KEYWORDS` in `.env` if wrong audience is being targeted
- [ ] Test message reply on 2–3 real unread threads
- [ ] Run feed task — review 5 generated comments for quality
- [ ] Adjust prompts in `src/claude-service.js` if tone is off

**Acceptance criteria:** >70% of evaluated profiles score 6+, generated messages sound like a real founder, no LinkedIn security warnings triggered.

---

## Phase 3 — Ramp Up (Weeks 2–3)

**Goal:** Gradually increase volume while monitoring for issues.

- [ ] Increase `WEEKLY_CONNECTION_LIMIT` to 25
- [ ] Enable daily message check (add to cron)
- [ ] Run feed task 3× per week
- [ ] Monitor connection acceptance rate in `data/connections-sent.json`
- [ ] Implement first-message flow for new connections
- [ ] Confirm no LinkedIn restriction warnings in logs
- [ ] Increase to 50 connections/week if no issues

---

## Phase 4 — Full Automation (Weeks 4–6+)

**Goal:** Set it and forget it — weekly autonomous outreach.

- [ ] Set `WEEKLY_CONNECTION_LIMIT=100`
- [ ] Set `HEADLESS=true` for background running
- [ ] Configure weekly cron schedule (see below)
- [ ] Set up log monitoring / alerts
- [ ] Establish monthly prompt review cadence
- [ ] Start tracking conversion: connection → reply → demo booked

---

## Recommended Weekly Schedule

| Task | Mon | Tue | Wed | Thu | Fri |
|------|-----|-----|-----|-----|-----|
| Connect (25–35 requests) | ✅ | — | ✅ | — | ✅ |
| Messages (check + reply) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Feed (comment 10 posts) | ✅ | — | ✅ | — | ✅ |
| First message (new connections) | — | ✅ | — | ✅ | — |

### Cron Strings

```bash
# Connect — Mon, Wed, Fri at 9am
node src/index.js connect   # cron: 0 9 * * 1,3,5

# Messages — weekdays at 8am
node src/index.js messages  # cron: 0 8 * * 1-5

# Feed — Mon, Wed, Fri at 10am
node src/index.js feed      # cron: 0 10 * * 1,3,5

# First messages to new connections — Tue, Thu at 9am
# (manual trigger after reviewing new connections)
```

---

## Improvement Roadmap

### High Impact

#### 1. Deep Profile Scraping
Visit each profile page before Claude evaluation to feed richer context.

**Why:** Claude currently scores profiles based on name + headline alone. With full profile data, scoring accuracy and message personalization improve dramatically.

**Implementation:**
```javascript
// In task-connect.js, before evaluateConnectionTarget():
await bot.page.goto(profile.url, { waitUntil: 'networkidle' });
const about = await bot.page.locator('#about ~ .pvs-list span[aria-hidden=true]').first().textContent();
const recentPosts = await bot.page.locator('.feed-shared-update-v2__description').allTextContents();
profile.about = about;
profile.recentActivity = recentPosts.slice(0, 2).join(' | ');
```

**Data added to Claude prompt:** about section, top 3 skills, most recent post, years of experience.

---

#### 2. Conversation Funnel Tracking
Track each connection through relationship stages.

**Stages:** `connected` → `first_message_sent` → `replied` → `interested` → `demo_booked`

**Why:** The current bot treats every conversation the same. Stage-aware messaging means follow-ups are contextually appropriate — not a repeated cold pitch.

**Implementation:**
- Add `stage` field to each profile in `connections-sent.json`
- Claude generates different message types per stage
- Auto follow-up after 5 days of silence (only once)
- Mark `demo_booked` manually or via keyword detection in replies

```json
{
  "name": "Jane Smith",
  "url": "...",
  "stage": "replied",
  "lastContact": "2025-05-01",
  "followUpSent": false
}
```

---

#### 3. Analytics Dashboard
A local web UI (`localhost:3000`) showing outreach performance.

**Metrics to track:**
- Connection acceptance rate by keyword
- Message reply rate over time
- Comment engagement (likes on comments)
- Best-performing connection note variants
- Weekly funnel: sent → accepted → replied → interested

**Implementation:** Small Express.js server reading the JSON data files. Chart.js for visualisations. Can be built as a single `dashboard.html` + `server.js`.

---

### Medium Impact

#### 4. Slack / Email Alerts
Get notified immediately when a high-intent reply comes in.

**Triggers:**
- Message contains: "interested", "tell me more", "demo", "pricing", "try it"
- New connection accepted from a score-9+ profile
- LinkedIn security challenge detected

**Implementation:**
```javascript
// Webhook to Slack
await fetch(process.env.SLACK_WEBHOOK_URL, {
  method: 'POST',
  body: JSON.stringify({ text: `🔥 Hot lead reply from ${name}: "${preview}"` })
});
```

---

#### 5. Auto-Post Content
Have Claude draft and schedule weekly LinkedIn posts about CUE AI.

**Content ideas:**
- Product updates and new features
- Founder journey / behind-the-scenes
- Use case stories ("How a dev used CUE AI in their FAANG interview")
- Engagement posts ("What's your biggest interview prep struggle?")

**Schedule:** 2× per week (Tuesday + Thursday, 9am). Complements the outreach by warming up the audience passively.

---

#### 6. A/B Message Testing
Run two variants of connection notes or first messages.

**How it works:**
1. Claude generates two versions (direct vs story-led)
2. Bot randomly assigns variant A or B per profile
3. Track acceptance rate and reply rate per variant
4. After 50 sends per variant, log the winner

**Implementation:** Add `variant` field to profile records. Weekly summary report in logs.

---

### Nice to Have

#### 7. Proxy Rotation
Route browser traffic through residential proxies at high volume.

- Use a residential proxy provider (Brightdata, Oxylabs, Smartproxy)
- Rotate IP per session
- Set in Playwright context: `proxy: { server: 'http://...' }`
- Recommended when running from a VPS or at 80+ connections/week

#### 8. CRM Integration
Push connected profiles + conversations into your tool of choice.

| CRM | Method | Effort |
|-----|--------|--------|
| Notion | Official API | Low |
| Airtable | REST API | Low |
| Google Sheets | `googleapis` npm package | Medium |
| HubSpot | CRM API | Medium |

Fields to sync: name, headline, URL, stage, first message sent, last reply date, score.

---

## Risks & Mitigations

| Risk | Level | Mitigation |
|------|-------|------------|
| LinkedIn account restriction / ban | High | Stay ≤100 connections/week. Randomise delays (5–15s). Don't run 24/7. Use session persistence. |
| CAPTCHA / verification challenge | High | Keep `HEADLESS=false` initially so you can solve manually. Session saves reduce frequency. |
| LinkedIn DOM selector changes | Medium | Monitor logs weekly. Keep selectors in named constants at top of each task file. |
| Claude API cost overrun | Medium | Each full run ≈ $0.05–0.20. Set Anthropic usage alerts at $20/month. |
| Generic / off-brand AI messages | Medium | Review first 20 messages manually. Add few-shot examples to Claude prompts. |
| Wrong audience targeted | Low | Tune `TARGET_KEYWORDS` and Claude's score threshold. Review connections JSON weekly. |

---

## LinkedIn Platform Limits (2025)

| Limit | Value |
|-------|-------|
| Connection requests per week | ~100 (safe), ~200 (risky) |
| Total pending requests | ~300 before LinkedIn blocks new ones |
| InMail messages (free account) | 0 (connection messages only) |
| Connection note character limit | 300 characters |

---

## Prompt Tuning Tips

The quality of everything — scores, messages, comments — comes from `src/claude-service.js`. Improve it by:

**1. Adding few-shot examples**
```javascript
// In generateConnectionNote(), add before the profile section:
`Examples of good notes:
- "Loved your post on debugging distributed systems — building something that might save engineers time in crunch moments. Would love to connect."
- "Fellow builder here — saw you're working in the interview-prep space. Would be great to swap notes."`
```

**2. Tightening the scoring criteria**
Add negative signals to `evaluateConnectionTarget()`:
```javascript
`Negative signals (score -2 each):
- Student with no work experience
- Completely unrelated industry (healthcare admin, law, real estate)
- Account seems inactive (no activity, generic profile)`
```

**3. Personalising with the founder voice**
Add your tone to every prompt:
```javascript
`Tone: Direct, builder-to-builder, no buzzwords. Think "I build things, you build things, let's talk" energy.`
```

---

## File Reference

```
linkedin-automation/
├── src/
│   ├── index.js            CLI entry + scheduler
│   ├── browser.js          Playwright base (stealth, session)
│   ├── claude-service.js   All Claude AI prompt calls
│   ├── task-connect.js     Connection request automation
│   ├── task-messages.js    Message reply + first message
│   └── task-feed.js        Feed scroll + comment
├── data/
│   ├── connections-sent.json
│   ├── messages-sent.json
│   ├── comments-sent.json
│   └── session.json        (auto-generated, gitignore this)
├── logs/
│   └── automation.log
├── .env                    (gitignore this)
├── .env.example
├── package.json
├── README.md               Setup + usage guide
└── PLAN.md                 This file
```

> **Note:** Add `data/session.json` and `.env` to your `.gitignore` — they contain credentials and auth tokens.

---

*Last updated: May 2026 — CUE AI LinkedIn Automation v1.0*
