import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import logger from './utils/logger.js';

export const activeBrowsers = new Set();

function encryptSession(text) {
  const password = process.env.SESSION_SECRET || process.env.DASHBOARD_PASSWORD || 'fallback_secret';
  const key = crypto.scryptSync(password, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return JSON.stringify({ iv: iv.toString('hex'), encrypted, authTag });
}

function decryptSession(jsonStr) {
  const { iv, encrypted, authTag } = JSON.parse(jsonStr);
  const password = process.env.SESSION_SECRET || process.env.DASHBOARD_PASSWORD || 'fallback_secret';
  const key = crypto.scryptSync(password, 'salt', 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export class BrowserManager {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.sessionPath = path.join(process.cwd(), 'data', 'session.json');
  }

  async launch(headless = true) {
    try {
      logger.info(`Launching browser (headless: ${headless})`);
      this.browser = await chromium.launch({
        headless,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage' // Prevent crashes in low-memory/container environments
        ],
        timeout: 60000 // Increase launch timeout
      });
      activeBrowsers.add(this);

      const PROFILES = [
        { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', viewport: { width: 1280, height: 800 } },
        { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36', viewport: { width: 1366, height: 768 } },
        { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', viewport: { width: 1440, height: 900 } },
        { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_3_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', viewport: { width: 1512, height: 982 } },
      ];
      const profile = PROFILES[Math.floor(Math.random() * PROFILES.length)];
      logger.info(`Browser profile: ${profile.viewport.width}x${profile.viewport.height}`);

      const options = {
        userAgent: profile.userAgent,
        viewport: profile.viewport,
        ignoreHTTPSErrors: true
      };

      if (fs.existsSync(this.sessionPath)) {
        logger.info('Loading existing session');
        try {
          const content = fs.readFileSync(this.sessionPath, 'utf8');
          const parsed = JSON.parse(content);
          if (parsed.iv && parsed.encrypted && parsed.authTag) {
            options.storageState = JSON.parse(decryptSession(content));
          } else {
            options.storageState = parsed; // Legacy unencrypted
          }
        } catch (e) {
          logger.warn('Failed to parse or decrypt session.json', { error: e.message });
        }
      }

      this.context = await this.browser.newContext(options);
      
      // Global timeouts to prevent infinite hangs
      this.context.setDefaultTimeout(30000);
      this.context.setDefaultNavigationTimeout(45000);

      this.page = await this.context.newPage();

      // Inject stealth scripts
      await this.page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        window.chrome = { runtime: {} };
      });

      return this.page;
    } catch (error) {
      logger.error('Failed to launch browser', { error: error.message });
      if (this.browser) await this.browser.close();
      throw error;
    }
  }

  async saveSession() {
    if (!this.context) return;
    logger.info('Saving encrypted session state');
    fs.mkdirSync(path.dirname(this.sessionPath), { recursive: true });
    const state = await this.context.storageState();
    const encrypted = encryptSession(JSON.stringify(state));
    fs.writeFileSync(this.sessionPath, encrypted, 'utf8');
  }

  // Enhancement B: Session validity check
  async isSessionValid() {
    if (!this.page) return false;
    try {
      logger.info('Checking session validity...');
      // Use domcontentloaded for faster check
      await this.page.goto('https://www.linkedin.com/feed/', { timeout: 15000, waitUntil: 'domcontentloaded' });
      const nav = await this.page.$('#global-nav');
      if (nav) return true;
      
      const loginBtn = await this.page.$('button:has-text("Sign in")');
      if (loginBtn) return false;

      return false;
    } catch (err) {
      logger.warn('Session check failed', { message: err.message });
      return false;
    }
  }

  async close() {
    try {
      if (this.page) await this.page.close().catch(() => {});
      if (this.context) await this.context.close().catch(() => {});
      if (this.browser) await this.browser.close().catch(() => {});
    } catch (e) {
      logger.error('Error during browser cleanup', { error: e.message });
    } finally {
      activeBrowsers.delete(this);
      this.page = null;
      this.context = null;
      this.browser = null;
    }
  }
}
