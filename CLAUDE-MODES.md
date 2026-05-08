# Claude Integration — CLI & Web Modes

The bot uses Claude AI for all decisions: scoring profiles, writing connection notes, generating messages, commenting on posts, and replying to conversations. It does **not** use the Anthropic API. Instead it routes through either the Claude CLI or the Claude website, using your existing subscription.

Set `CLAUDE_MODE` in your `.env` to choose:

```
CLAUDE_MODE=cli   # default — spawns `claude -p "..."` in a shell
CLAUDE_MODE=web   # opens claude.ai in a Playwright browser tab
```

---

## Option A — CLI Mode (Recommended)

The bot spawns the `claude` command as a child process for each AI call, reads stdout, and uses the response. Fastest, most reliable, fully headless.

### Setup (one-time)

```bash
# Install the Claude CLI globally
npm install -g @anthropic-ai/claude-code

# Log in — opens a browser once, then saves credentials
claude login
```

### Verify it works

```bash
claude -p "Say hello"
```

If you see a response, you're ready. Set `CLAUDE_MODE=cli` in `.env` and run the bot normally.

### How it works

Each AI call runs this internally:

```
claude --no-markdown -p "<full combined prompt>"
```

The full prompt includes your product context, the extracted LinkedIn data (name, headline, company, post text, incoming message — whatever is relevant), and precise output rules. The CLI prints the response to stdout; the bot captures it and uses it directly.

---

## Option B — Web Mode

The bot opens a dedicated Playwright browser window pointed at claude.ai. For each AI call it navigates to a new conversation, types the prompt, waits for streaming to finish, and extracts the response text.

### Setup (one-time)

```bash
# Set in .env
CLAUDE_MODE=web
```

On the very first run, a Chromium window opens on claude.ai. Log in manually. The session is saved to `data/claude-session.json` — all future runs load that session silently, no login needed.

### Notes

- The browser window stays open for the entire duration of a run (all AI calls share one tab)
- It closes automatically when the task finishes
- If your claude.ai session expires, delete `data/claude-session.json` and log in again on the next run
- `data/claude-session.json` contains auth cookies — never commit it (already in `.gitignore`)

---

## How Prompts Are Built

Every function in `src/claude-service.js` assembles a single self-contained prompt with four sections before sending it to Claude:

```
CONTEXT     — who you are: founder name, product name, product description (from .env)
TASK        — what to generate: score, note, message, comment, reply, post
RULES       — tone, length limits, what to avoid, output format
INPUT DATA  — the extracted LinkedIn data for this specific call
OUTPUT RULE — "Return ONLY the reply text" so Claude gives clean output with no preamble
```

### What each call sends and receives

| Bot action | Data sent to Claude | What Claude returns |
|---|---|---|
| Score a profile | Name, headline, company, about section, open-to-work flag | `{"score": 1–10, "reason": "one sentence"}` |
| Write connection note | Name, headline, company | Plain text ≤ 280 chars |
| Check post relevance | Post text (first 600 chars) | `{"relevant": true/false, "reason": "phrase"}` |
| Write feed comment | Full post text | Plain text, 1–2 sentences |
| Write first message | Name, headline, company, about | Plain text ≤ 400 chars |
| Write reply to inbox message | Name, headline, their message | Plain text reply, or `ESC_HUMAN` to escalate |
| Write LinkedIn post | A topic string | Plain text, 1–3 paragraphs |

### ESC_HUMAN escalation

The reply function instructs Claude to return the literal string `ESC_HUMAN` (nothing else) if the incoming message contains:

- Pricing or payment questions
- Enterprise / team licensing
- Technical bug reports
- Legal, privacy, or security concerns
- Angry or negative messages

When the bot receives `ESC_HUMAN`, it skips sending a reply and writes the conversation to `data/review-queue.ndjson` for you to handle manually.

---

## Files Involved

```
src/
├── claude-service.js        All AI functions — routes to CLI or web based on CLAUDE_MODE
└── utils/
    ├── claude-cli.js        Spawns `claude -p "..."`, captures stdout, retries on failure
    └── claude-web.js        Playwright client for claude.ai — session management, prompt sending, response extraction

data/
└── claude-session.json      Saved claude.ai browser session (web mode only — never commit)
```

---

## Troubleshooting

**CLI: `Claude CLI not found in PATH`**
Run `npm install -g @anthropic-ai/claude-code` then `claude login`.

**CLI: Response is empty or garbled**
Run `claude -p "say hello"` directly in your terminal to confirm the CLI works outside the bot.

**Web: Selectors stopped working after a claude.ai update**
Open `src/utils/claude-web.js` and update the `SEL` object at the top of the file. The four selector arrays cover the input field, send button, stop button, and response container.

**Web: Bot is stuck waiting for a response**
The stability poller has a 2-minute hard cap. If Claude takes longer than that (rare), the partial response is returned. Check `logs/automation.log` for a timeout warning.

**Web: Login required every run**
Delete `data/claude-session.json` and let the bot re-create it by logging in once.
