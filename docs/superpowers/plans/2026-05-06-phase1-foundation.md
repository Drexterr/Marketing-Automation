# Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a modular LinkedIn automation foundation with session persistence, logging, and Claude API connectivity.

**Architecture:** Instance-based BrowserManager for stateful browser control, functional ClaudeService for AI, and Winston for centralized logging.

**Tech Stack:** Node.js (ESM), Playwright, Anthropic SDK, Winston, Dotenv, Commander.

---

### Task 1: Project Structure & Configuration

**Files:**
- Create: `src/utils/logger.js`
- Create: `.env` (from `.env.example`)
- Create: `.gitignore`

- [ ] **Step 1: Create directories**
Run: `mkdir -p src/utils data logs`

- [ ] **Step 2: Create .env from example**
Run: `cp .env.example .env`

- [ ] **Step 3: Create .gitignore**
```text
node_modules
.env
data/session.json
logs/*.log
```

- [ ] **Step 4: Implement Logger**
```javascript
import winston from 'winston';
import path from 'path';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join('logs', 'automation.log') }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

export default logger;
```

- [ ] **Step 5: Verify logger works**
Run: `node -e 'import logger from "./src/utils/logger.js"; logger.info("Test log");'`
Expected: "info: Test log" in console and `logs/automation.log` exists.

- [ ] **Step 6: Commit**
```bash
git add src/utils/logger.js .gitignore .env.example
git commit -m "chore: initial project structure and logger"
```

---

### Task 2: BrowserManager Implementation

**Files:**
- Create: `src/browser.js`

- [ ] **Step 1: Write minimal BrowserManager**
```javascript
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import logger from './utils/logger.js';

export class BrowserManager {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.sessionPath = path.join('data', 'session.json');
  }

  async launch(headless = true) {
    logger.info(`Launching browser (headless: ${headless})`);
    this.browser = await chromium.launch({ 
      headless,
      args: ['--disable-blink-features=AutomationControlled'] 
    });

    const options = {};
    if (fs.existsSync(this.sessionPath)) {
      logger.info('Loading existing session');
      options.storageState = this.sessionPath;
    }

    this.context = await this.browser.newContext(options);
    this.page = await this.context.newPage();
    return this.page;
  }

  async saveSession() {
    logger.info('Saving session state');
    await this.context.storageState({ path: this.sessionPath });
  }

  async close() {
    if (this.browser) await this.browser.close();
  }
}
```

- [ ] **Step 2: Verify browser launch**
Run: `node -e 'import { BrowserManager } from "./src/browser.js"; const b = new BrowserManager(); await b.launch(true); await b.close(); console.log("Success");'`
Expected: "Success" and logs show "Launching browser".

- [ ] **Step 3: Commit**
```bash
git add src/browser.js
git commit -m "feat: add BrowserManager with session persistence"
```

---

### Task 3: Claude Service Implementation

**Files:**
- Create: `src/claude-service.js`

- [ ] **Step 1: Implement testClaudeConnection**
```javascript
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import logger from './utils/logger.js';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function testClaudeConnection() {
  try {
    logger.info('Testing Claude API connection');
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Say "Connection successful"' }],
    });
    return message.content[0].text;
  } catch (error) {
    logger.error('Claude API test failed', error);
    throw error;
  }
}
```

- [ ] **Step 2: Verify Claude Connection (mocked or real if key present)**
Run: `node -e 'import { testClaudeConnection } from "./src/claude-service.js"; testClaudeConnection().then(console.log).catch(console.error)'`
Expected: "Connection successful" (if key is valid).

- [ ] **Step 3: Commit**
```bash
git add src/claude-service.js
git commit -m "feat: add Claude service with connection test"
```

---

### Task 4: CLI Entry Point & Setup Flow

**Files:**
- Create: `src/index.js`
- Modify: `package.json`

- [ ] **Step 1: Implement Setup Command**
```javascript
import { BrowserManager } from './browser.js';
import { testClaudeConnection } from './claude-service.js';
import logger from './utils/logger.js';

async function setup() {
  const browserManager = new BrowserManager();
  try {
    logger.info('Starting Phase 1 Setup...');
    
    // 1. Test Claude
    const claudeResult = await testClaudeConnection();
    logger.info(`Claude Connection: ${claudeResult}`);

    // 2. LinkedIn Login
    const page = await browserManager.launch(false); // Force visible for setup
    await page.goto('https://www.linkedin.com/login');
    
    logger.info('Please log in manually. Waiting for feed...');
    
    // Wait for the feed navigation element to appear (signaling success)
    await page.waitForSelector('#global-nav', { timeout: 0 }); 
    
    await browserManager.saveSession();
    logger.info('Session saved successfully to data/session.json');

  } catch (error) {
    logger.error('Setup failed', error);
  } finally {
    await browserManager.close();
  }
}

const command = process.argv[2];
if (command === 'setup') {
  setup();
} else {
  console.log('Usage: node src/index.js setup');
}
```

- [ ] **Step 2: Update package.json scripts**
```json
"scripts": {
  "setup": "node src/index.js setup"
}
```

- [ ] **Step 3: Verify end-to-end setup (Dry Run)**
Run: `npm run setup`
Expected: Browser opens, navigates to LinkedIn login. (Note: Actual login requires user interaction).

- [ ] **Step 4: Commit**
```bash
git add src/index.js package.json
git commit -m "feat: implement CLI setup flow"
```
