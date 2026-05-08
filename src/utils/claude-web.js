import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import logger from './logger.js';

const SESSION_PATH = path.join(process.cwd(), 'data', 'claude-session.json');

// Selectors for claude.ai — update these if Anthropic changes their DOM
const SEL = {
  // The ProseMirror rich-text input where you type prompts
  input: [
    'div.ProseMirror[contenteditable="true"]',
    '[contenteditable="true"][data-placeholder]',
    'div[contenteditable="true"]',
  ],
  // Button that sends the message
  sendBtn: [
    'button[aria-label="Send message"]',
    'button[aria-label="Send Message"]',
    'button[data-testid="send-button"]',
  ],
  // Button that appears WHILE Claude is generating (disappears when done)
  stopBtn: [
    'button[aria-label="Stop"]',
    'button[aria-label="Stop generating"]',
    'button[aria-label="Stop response"]',
  ],
  // Container for the last assistant reply
  assistantMsg: [
    '[data-testid="assistant-message"]',
    '.font-claude-message',
    '[class*="assistant-message"]',
  ],
};

async function findElement(page, selectorList, timeout = 15000) {
  for (const sel of selectorList) {
    try {
      const el = await page.waitForSelector(sel, { timeout: 3000 });
      if (el) return el;
    } catch {
      // try next selector
    }
  }
  throw new Error(`None of these selectors found within ${timeout}ms:\n${selectorList.join('\n')}`);
}

async function queryAll(page, selectorList) {
  for (const sel of selectorList) {
    const els = await page.$$(sel);
    if (els.length > 0) return els;
  }
  return [];
}

// ─── Singleton so we reuse one browser tab across multiple calls ──────────────
let _client = null;

export async function getWebClient() {
  if (!_client) {
    _client = new ClaudeWebClient();
    await _client.launch();
  }
  return _client;
}

export async function closeWebClient() {
  if (_client) {
    await _client.close();
    _client = null;
  }
}

// Close cleanly on process exit
process.on('exit', () => { if (_client) _client.close(); });
process.on('SIGINT', async () => { await closeWebClient(); process.exit(0); });

// ─── ClaudeWebClient ──────────────────────────────────────────────────────────
export class ClaudeWebClient {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async launch() {
    logger.info('Launching Claude.ai browser...');
    this.browser = await chromium.launch({
      headless: false, // must stay visible so you can log in the first time
      args: ['--disable-blink-features=AutomationControlled'],
    });

    const contextOptions = {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1100, height: 860 },
    };

    if (fs.existsSync(SESSION_PATH)) {
      logger.info('Loading saved Claude.ai session');
      contextOptions.storageState = SESSION_PATH;
    }

    this.context = await this.browser.newContext(contextOptions);
    this.page = await this.context.newPage();

    await this.page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    await this.page.goto('https://claude.ai', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));

    const needsLogin = await this.page.$('button:has-text("Sign in"), a:has-text("Sign in"), input[name="email"]').catch(() => null);
    if (needsLogin) {
      logger.info('Claude.ai is not logged in. Please log in manually in the browser window.');
      logger.info('The script will continue automatically after you reach the home screen.');
      // Wait until the user lands on a page that has a conversation input
      await this.page.waitForSelector(SEL.input[0], { timeout: 0 }).catch(() => {});
      await this.saveSession();
      logger.info('Claude.ai session saved to data/claude-session.json');
    }

    logger.info('Claude.ai ready.');
  }

  async saveSession() {
    fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true });
    await this.context.storageState({ path: SESSION_PATH });
  }

  // Send a prompt and return the full response text
  async ask(prompt) {
    logger.info('Opening new Claude.ai conversation...');

    // Navigate to a fresh chat every time so history never accumulates
    await this.page.goto('https://claude.ai/new', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1500));

    // Find the input area
    const input = await findElement(this.page, SEL.input);
    await input.click();
    await this.page.keyboard.press('Control+a');
    await this.page.keyboard.press('Backspace');

    // Fill the prompt (no per-character delay — we're not simulating a human here)
    await input.fill(prompt);
    await new Promise(r => setTimeout(r, 400));

    // Click send
    const sendBtn = await findElement(this.page, SEL.sendBtn);
    await sendBtn.click();
    logger.info('Prompt sent. Waiting for Claude response...');

    // Wait for response
    const response = await this._waitForResponse();
    logger.info(`Claude responded (${response.length} chars)`);
    return response;
  }

  async _waitForResponse() {
    // Phase 1: wait for the stop button to appear (streaming started) — 30s max
    let streamingStarted = false;
    for (const sel of SEL.stopBtn) {
      try {
        await this.page.waitForSelector(sel, { timeout: 30000 });
        streamingStarted = true;
        break;
      } catch { /* try next */ }
    }

    if (!streamingStarted) {
      logger.warn('Stop button not detected. Falling back to text stability check.');
    }

    // Phase 2: poll until the response text stops changing for 2 consecutive seconds
    let previousText = '';
    let stableMs = 0;
    const STABLE_THRESHOLD = 2000; // ms of no change = done
    const POLL_INTERVAL = 500;
    const MAX_WAIT = 120000; // 2 min absolute cap
    const startedAt = Date.now();

    while (stableMs < STABLE_THRESHOLD) {
      if (Date.now() - startedAt > MAX_WAIT) {
        logger.warn('Claude response timed out after 2 minutes. Returning partial response.');
        break;
      }

      await new Promise(r => setTimeout(r, POLL_INTERVAL));

      const currentText = await this._extractLastResponse();

      if (currentText && currentText === previousText) {
        stableMs += POLL_INTERVAL;
      } else {
        stableMs = 0;
        previousText = currentText;
      }
    }

    // Extra 300ms for any final DOM update
    await new Promise(r => setTimeout(r, 300));
    return this._extractLastResponse();
  }

  async _extractLastResponse() {
    const msgs = await queryAll(this.page, SEL.assistantMsg);
    if (msgs.length === 0) return '';
    const last = msgs[msgs.length - 1];
    return (await last.innerText().catch(() => '')).trim();
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
