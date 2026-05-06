import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { logger } from "./src/utils/logger.js";

const SESSION_FILE = path.join(process.cwd(), "data", "session.json");

export class LinkedInBrowser {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async launch() {
    logger.info("Launching browser...");

    this.browser = await chromium.launch({
      headless: process.env.HEADLESS === "true",
      slowMo: parseInt(process.env.SLOW_MO || "50"),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
    });

    // Load saved session if exists
    const contextOptions = {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    };

    if (fs.existsSync(SESSION_FILE)) {
      logger.info("Loading saved session...");
      const sessionData = JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8"));
      contextOptions.storageState = sessionData;
    }

    this.context = await this.browser.newContext(contextOptions);
    this.page = await this.context.newPage();

    // Stealth: remove automation flags
    await this.page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      window.chrome = { runtime: {} };
    });

    return this.page;
  }

  async login() {
    logger.info("Navigating to LinkedIn...");
    await this.page.goto("https://www.linkedin.com/feed/", {
      waitUntil: "networkidle",
    });

    // Check if already logged in
    const isLoggedIn = await this.page
      .locator('[data-test-id="nav-settings-dropdown"]')
      .isVisible()
      .catch(() => false);

    if (isLoggedIn) {
      logger.info("Already logged in via session");
      return true;
    }

    // Check if on login page
    const onLoginPage = await this.page
      .locator("#username")
      .isVisible()
      .catch(() => false);

    if (!onLoginPage) {
      await this.page.goto("https://www.linkedin.com/login", {
        waitUntil: "networkidle",
      });
    }

    logger.info("Logging in...");
    await this.page.fill("#username", process.env.LINKEDIN_EMAIL);
    await this.randomDelay(500, 1000);
    await this.page.fill("#password", process.env.LINKEDIN_PASSWORD);
    await this.randomDelay(500, 1000);
    await this.page.click('[type="submit"]');
    await this.page.waitForNavigation({ waitUntil: "networkidle" });

    // Check for verification challenge
    const needsVerification = await this.page
      .locator("text=verification")
      .isVisible()
      .catch(() => false);
    if (needsVerification) {
      logger.warn(
        "⚠️  LinkedIn requires verification. Please complete it manually in the browser window."
      );
      await this.page.waitForNavigation({ timeout: 120000 });
    }

    // Save session
    const storageState = await this.context.storageState();
    fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
    fs.writeFileSync(SESSION_FILE, JSON.stringify(storageState));
    logger.info("Session saved");

    return true;
  }

  async randomDelay(min = 1000, max = 3000) {
    const delay = Math.floor(Math.random() * (max - min) + min);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  async humanScroll(distance = 500) {
    await this.page.evaluate((d) => window.scrollBy(0, d), distance);
    await this.randomDelay(500, 1500);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}
