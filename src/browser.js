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
