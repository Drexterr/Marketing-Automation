import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

import { sendAlert, sendCritical } from './alerts.js';
import { RuntimeStateService } from '../../backend-api/services/RuntimeStateService.js';
import { ConnectionRepository } from '../../shared/repositories/ConnectionRepository.js';
import { ReviewQueueRepository } from '../../shared/repositories/ReviewQueueRepository.js';
import { SqliteRepository } from '../../shared/repositories/SqliteRepository.js';

const connectionRepo = new ConnectionRepository();
const reviewQueueRepo = new ReviewQueueRepository();
const schedulerRunsRepo = new SqliteRepository('scheduler_runs');

export const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

export async function getSystemState() {
  const state = RuntimeStateService.getFlag('system_state') || {};
  if (!state.firstRunDate) {
    state.firstRunDate = new Date().toISOString();
  }
  if (!state.currentWeek) {
    state.currentWeek = 1;
  }

  // Operational Visibility Extensions
  try {
    const lastRun = schedulerRunsRepo.db.prepare(`SELECT * FROM scheduler_runs WHERE status = 'completed' ORDER BY start_time DESC LIMIT 1`).get();
    if (lastRun) state.lastSuccessfulRun = lastRun.start_time;

    const lastFailed = schedulerRunsRepo.db.prepare(`SELECT * FROM scheduler_runs WHERE status = 'failed' ORDER BY start_time DESC LIMIT 1`).get();
    if (lastFailed) state.lastFailureReason = lastFailed.failure_reason;
  } catch (e) {
    // Table might not exist yet if migration hasn't run
  }

  state.emergencyStop = RuntimeStateService.getFlag('emergency_stop');
  const pulse = RuntimeStateService.getPulse();
  state.currentTask = pulse.activeTask;
  
  try {
    const pendingReviews = reviewQueueRepo.db.prepare(`SELECT COUNT(*) as count FROM review_queue WHERE status = 'pending'`).get().count;
    state.pendingReviewQueueCount = pendingReviews;
  } catch (e) {
    // ignore
  }

  return state;
}

export async function updateSystemState(updates) {
  const currentState = await getSystemState();
  const newState = { ...currentState, ...updates };
  
  if (!newState.firstRunDate) {
    newState.firstRunDate = new Date().toISOString();
  }

  // Calculate current week based on firstRunDate
  const firstRun = new Date(newState.firstRunDate);
  const now = new Date();
  const diffDays = Math.floor((now - firstRun) / (1000 * 60 * 60 * 24));
  newState.currentWeek = Math.floor(diffDays / 7) + 1;

  RuntimeStateService.setFlag('system_state', newState);
  return newState;
}

export async function getDynamicWeeklyLimit() {
  const state = await updateSystemState({}); // Ensure state is fresh
  const limits = [25, 30, 35, 40, 50]; // Week 1, 2, 3, 4, 5+ (Safer progression)
  return limits[Math.min(state.currentWeek - 1, limits.length - 1)];
}

/**
 * Updated to use ConnectionRepository
 */
export async function checkDailyLimit(filePath, maxDaily = 10) {
  const todayCount = connectionRepo.countSentToday();
  return todayCount < maxDaily;
}

export async function appendReviewQueue(entry) {
  const { type, status, response, ...data } = entry;
  reviewQueueRepo.create({
    type: type || 'system',
    status: status || 'pending',
    response: response || null,
    data: JSON.stringify(data)
  });
}

export async function takeScreenshotOnFailure(page, operationName) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotDir = path.join(process.cwd(), 'logs', 'screenshots');
    const htmlDir = path.join(process.cwd(), 'logs', 'snapshots');
    
    await fsPromises.mkdir(screenshotDir, { recursive: true });
    await fsPromises.mkdir(htmlDir, { recursive: true });

    const screenshotPath = path.join(screenshotDir, `${operationName}-${timestamp}.png`);
    const htmlPath = path.join(htmlDir, `${operationName}-${timestamp}.html`);

    await page.screenshot({ path: screenshotPath, fullPage: true });
    const html = await page.content();
    await fsPromises.writeFile(htmlPath, html, 'utf8');

    logger.error(`Diagnostic capture: ${operationName}`, { screenshotPath, htmlPath });
  } catch (e) {
    logger.error('Failed to capture diagnostics', { error: e.message });
  }
}

export async function isSessionValid(page) {
  try {
    const currentUrl = page.url();
    if (currentUrl.includes('linkedin.com/checkpoint/challenge')) {
      logger.security('Security checkpoint detected!', { url: currentUrl });
      RuntimeStateService.emergencyStop();
      return false;
    }

    const isLogin = await page.$('input[name="session_key"]');
    const isCaptcha = await page.$('#captcha-internal'); // Common ID for LinkedIn CAPTCHA
    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasRestrictedMsg = bodyText.includes('Your account has been restricted') || bodyText.includes('Temporarily Restricted');
    
    if (isLogin || isCaptcha || hasRestrictedMsg) {
      let reason = 'unknown';
      if (isLogin) reason = 'unusual login challenge';
      if (isCaptcha) reason = 'captcha detected';
      if (hasRestrictedMsg) reason = 'account restricted warning';
      
      await appendReviewQueue({
        type: 'safety_warning',
        reason: reason,
        profile: 'system'
      });
      await sendCritical(`LinkedIn security trigger: ${reason}. System paused.`);
      RuntimeStateService.emergencyStop(); // Propagate stop signal
      return false;
    }
    return true;
  } catch (e) {
    logger.warn('Error during session validation', { error: e.message });
    return false;
  }
}

export async function checkAuthMidWorkflow(page, operationName) {
  const isValid = await isSessionValid(page);
  if (!isValid) {
    await takeScreenshotOnFailure(page, `AUTH_LOST_${operationName}`);
    throw new EmergencyStopError(`Session lost during ${operationName}`);
  }
}

/**
 * Robust selector finder with multiple candidates and automatic diagnostics
 */
export async function safeWaitForSelector(page, selectors, timeout = 10000, operationName = 'generic') {
  const selectorList = Array.isArray(selectors) ? selectors : [selectors];
  
  for (const selector of selectorList) {
    try {
      const el = await page.waitForSelector(selector, { timeout: timeout / selectorList.length });
      if (el) return el;
    } catch (e) {
      // try next
    }
  }
  
  await takeScreenshotOnFailure(page, `SELECTOR_FAILURE_${operationName}`);
  throw new Error(`Failed to find any selectors for ${operationName}: ${selectorList.join(', ')}`);
}

// ─── Human-like interaction helpers ──────────────────────────────────────────

export class EmergencyStopError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EmergencyStopError';
  }
}

export async function humanType(element, text, signal = null) {
  for (const char of text) {
    if (signal?.aborted) throw new Error('Task aborted by timeout');
    if (RuntimeStateService.getFlag('emergency_stop')) throw new EmergencyStopError('Emergency stop interrupted typing');
    await element.type(char);
    await new Promise(r => setTimeout(r, randomBetween(30, 130)));
  }
}

export async function humanClick(element, signal = null) {
  if (signal?.aborted) throw new Error('Task aborted by timeout');
  if (RuntimeStateService.getFlag('emergency_stop')) throw new EmergencyStopError('Emergency stop interrupted click');
  await element.hover();
  await new Promise(r => setTimeout(r, randomBetween(200, 500)));
  await element.click();
}

export async function humanScroll(page, signal = null) {
  if (signal?.aborted) throw new Error('Task aborted by timeout');
  if (RuntimeStateService.getFlag('emergency_stop')) throw new EmergencyStopError('Emergency stop interrupted scroll');
  const amount = randomBetween(300, 900);
  await page.evaluate((px) => window.scrollBy(0, px), amount);
  await randomDelay(1000, 3000, signal);
}

export const randomDelay = async (min = 8000, max = 25000, signal = null) => {
  const target = randomBetween(min, max);
  const start = Date.now();
  while (Date.now() - start < target) {
    if (signal?.aborted) throw new Error('Task aborted by timeout');
    if (RuntimeStateService.getFlag('emergency_stop')) throw new EmergencyStopError('Emergency stop interrupted delay');
    
    // Pulse the pulse
    const elapsed = Date.now() - start;
    const progress = Math.min(100, Math.floor((elapsed / target) * 100));
    RuntimeStateService.updatePulse({ progress });

    await new Promise(r => setTimeout(r, 1000));
  }
};

export function isWithinOperatingHours() {
  const hour = new Date().getHours();
  return hour >= 9 && hour < 20;
}
