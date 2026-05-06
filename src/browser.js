import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import logger from './utils/logger.js';

export class BrowserManager {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    // Fix 5: Correct session path resolution
    this.sessionPath = path.join(process.cwd(), 'data', 'session.json');
  }

  async launch(headless = true) {
    logger.info(`Launching browser (headless: ${headless})`);
    this.browser = await chromium.launch({ 
      headless,
      args: ['--disable-blink-features=AutomationControlled'] 
    });

    const options = {
      // Fix 2: Anti-detection stealth baseline
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 }
    };

    if (fs.existsSync(this.sessionPath)) {
      logger.info('Loading existing session');
      options.storageState = this.sessionPath;
    }

    this.context = await this.browser.newContext(options);
    this.page = await this.context.newPage();

    // Fix 2: Inject stealth scripts
    await this.page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      window.chrome = { runtime: {} };
    });

    return this.page;
  }

  // Fix 1: Ensure directory exists before saving
  async saveSession() {
    logger.info('Saving session state');
    fs.mkdirSync(path.dirname(this.sessionPath), { recursive: true });
    await this.context.storageState({ path: this.sessionPath });
  }

  // Enhancement B: Session validity check
  async isSessionValid() {
    if (!this.page) return false;
    try {
      logger.info('Checking session validity...');
      await this.page.goto('https://www.linkedin.com/feed/', { timeout: 10000 });
      await this.page.waitForSelector('#global-nav', { timeout: 5000 });
      return true;
    } catch (err) {
      logger.warn('Session check failed', { message: err.message });
      return false;
    }
  }

  async close() {
    if (this.browser) await this.browser.close();
  }
}
