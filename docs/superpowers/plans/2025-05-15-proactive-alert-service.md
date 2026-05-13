# Proactive Alert Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a proactive `AlertService` that sends notifications to Telegram or Slack with debouncing to prevent spam.

**Architecture:** A singleton-like service module with internal state for debouncing. It supports multiple notification channels (Slack, Telegram) and falls back to logging.

**Tech Stack:** Node.js, `fetch` (native), `node:test` for testing.

---

### Task 1: Research and Setup

**Files:**
- Modify: `src/utils/alerts.js`
- Create: `src/utils/alerts.test.js`

- [ ] **Step 1: Write a failing test for basic Slack alert**
```javascript
import { test, describe, mock } from 'node:test';
import assert from 'node:assert';
import { sendAlert } from './alerts.js';

describe('AlertService', () => {
  test('sendAlert should call fetch for Slack when SLACK_WEBHOOK_URL is set', async (t) => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test';
    const fetchMock = t.mock.method(global, 'fetch', () => Promise.resolve({ ok: true }));
    
    await sendAlert('Test message');
    
    assert.strictEqual(fetchMock.mock.callCount(), 1);
    const [url, options] = fetchMock.mock.calls[0].arguments;
    assert.strictEqual(url, process.env.SLACK_WEBHOOK_URL);
    assert.ok(options.body.includes('Test message'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails (or passes if existing code is enough)**
Run: `node --test src/utils/alerts.test.js`

- [ ] **Step 3: Refactor `src/utils/alerts.js` to support Telegram and basic methods**
```javascript
import logger from './logger.js';

const COOLDOWN_PERIOD = 5 * 60 * 1000; // 5 minutes
const alertHistory = new Map();

export async function sendAlert(message, level = 'info') {
  const now = Date.now();
  const historyKey = `${level}:${message}`;
  
  if (alertHistory.has(historyKey) && (now - alertHistory.get(historyKey)) < COOLDOWN_PERIOD) {
    logger.debug(`Alert debounced: ${message}`);
    return;
  }
  
  alertHistory.set(historyKey, now);

  const timestamp = new Date().toLocaleString();
  const formattedMessage = `[${level.toUpperCase()}] ${timestamp}: ${message}`;

  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;

  let sent = false;

  if (slackUrl) {
    try {
      await fetch(slackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `🚨 *LinkedIn Bot Alert*:\n${formattedMessage}` })
      });
      sent = true;
    } catch (error) {
      logger.error('Failed to send Slack alert', { message: error.message });
    }
  }

  if (telegramToken && telegramChatId) {
    try {
      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: `🚨 LinkedIn Bot Alert:\n${formattedMessage}`
        })
      });
      sent = true;
    } catch (error) {
      logger.error('Failed to send Telegram alert', { message: error.message });
    }
  }

  if (!sent) {
    logger.info(`Alert (Console): ${formattedMessage}`);
  }
}

export const sendCritical = (message) => sendAlert(message, 'critical');
export const sendWarning = (message) => sendAlert(message, 'warning');
```

- [ ] **Step 4: Run test to verify it passes**
Run: `node --test src/utils/alerts.test.js`

- [ ] **Step 5: Commit**
```bash
git add src/utils/alerts.js src/utils/alerts.test.js
git commit -m "feat: basic AlertService with Slack and Telegram support"
```

### Task 2: Implement Cooldown/Debouncing Logic

**Files:**
- Modify: `src/utils/alerts.test.js`
- Modify: `src/utils/alerts.js`

- [ ] **Step 1: Write a failing test for debouncing**
```javascript
  test('sendAlert should debounce repeated messages', async (t) => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test';
    const fetchMock = t.mock.method(global, 'fetch', () => Promise.resolve({ ok: true }));
    
    await sendAlert('Repeat message');
    await sendAlert('Repeat message');
    
    assert.strictEqual(fetchMock.mock.callCount(), 1);
  });
```

- [ ] **Step 2: Run test to verify it fails (it should pass if implemented in Task 1)**
Run: `node --test src/utils/alerts.test.js`

- [ ] **Step 3: Add test for different messages (should NOT debounce)**
```javascript
  test('sendAlert should NOT debounce different messages', async (t) => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test';
    const fetchMock = t.mock.method(global, 'fetch', () => Promise.resolve({ ok: true }));
    
    await sendAlert('Message A');
    await sendAlert('Message B');
    
    assert.strictEqual(fetchMock.mock.callCount(), 2);
  });
```

- [ ] **Step 4: Commit**
```bash
git add src/utils/alerts.js src/utils/alerts.test.js
git commit -m "test: verify debouncing logic in AlertService"
```

### Task 3: Integration with Telegram

**Files:**
- Modify: `src/utils/alerts.test.js`

- [ ] **Step 1: Write a test for Telegram alert**
```javascript
  test('sendAlert should call Telegram API when tokens are set', async (t) => {
    process.env.TELEGRAM_BOT_TOKEN = 'token123';
    process.env.TELEGRAM_CHAT_ID = 'chat456';
    delete process.env.SLACK_WEBHOOK_URL;
    
    const fetchMock = t.mock.method(global, 'fetch', () => Promise.resolve({ ok: true }));
    
    await sendAlert('Telegram test');
    
    assert.strictEqual(fetchMock.mock.callCount(), 1);
    const [url] = fetchMock.mock.calls[0].arguments;
    assert.ok(url.includes('api.telegram.org/bottoken123/sendMessage'));
  });
```

- [ ] **Step 2: Run test to verify it passes**
Run: `node --test src/utils/alerts.test.js`

- [ ] **Step 3: Commit**
```bash
git add src/utils/alerts.test.js
git commit -m "test: verify Telegram integration in AlertService"
```

### Task 4: Final Refinement and Integration

**Files:**
- Modify: `src/utils/alerts.js`
- Modify: `src/utils/helpers.js` (Optional: use `sendCritical` where appropriate)

- [ ] **Step 1: Export `sendCritical` and `sendWarning` in `alerts.js`**
(Already included in Task 1 code block, but ensure it's exported)

- [ ] **Step 2: Update `isSessionValid` in `helpers.js` to use `sendCritical`**
```javascript
// In src/utils/helpers.js
import { sendAlert, sendCritical } from './alerts.js'; // Update import

// ... in isSessionValid
      await sendCritical(`LinkedIn security trigger: ${reason}. System paused.`);
```

- [ ] **Step 3: Run all tests to ensure no regressions**
Run: `npm test`

- [ ] **Step 4: Commit**
```bash
git add src/utils/alerts.js src/utils/helpers.js
git commit -m "feat: integrate sendCritical into session validation"
```
