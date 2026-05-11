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

/**
 * Updated to use ConnectionRepository
 */
export const appendConnection = async (filePath, entry) => {
  // We ignore filePath as we use SQLite now, but keep signature for compatibility
  const { url, status, lastAction, ...data } = entry;
  connectionRepo.upsert(url, status || 'sent', lastAction || 'connect', data);
};

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

export async function isSessionValid(page) {
  try {
    const isLogin = await page.$('input[name="session_key"]');
    const isCaptcha = await page.$('#captcha-internal'); // Common ID for LinkedIn CAPTCHA
    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasRestrictedMsg = bodyText.includes('Your account has been restricted');
    
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
  } catch {
    return false;
  }
}

export async function logSessionSummary(summary) {
  const logFile = path.join(process.cwd(), 'logs', 'session-summary.ndjson');
  const dir = path.dirname(logFile);
  await fsPromises.mkdir(dir, { recursive: true });
  
  const line = JSON.stringify({
    ...summary,
    timestamp: new Date().toISOString()
  }) + '\n';
  
  await fsPromises.appendFile(logFile, line);
}

/**
 * Updated to use ConnectionRepository
 */
export async function updateConnectionRecord(filePath, url, updates) {
  const status = updates.status || null;
  const lastAction = updates.lastAction || null;
  
  const newData = { ...updates };
  delete newData.status;
  delete newData.lastAction;
  delete newData.url;

  connectionRepo.upsert(url, status, lastAction, newData);
}

/**
 * Updated to use ConnectionRepository
 */
export function loadConnections(filePath) {
  // If it's a feed file, we might still want to use the file-based loader
  if (filePath && (filePath.includes('feed') || filePath.includes('actions'))) {
    try {
      return fs.readFileSync(filePath, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line));
    } catch {
      return [];
    }
  }
  
  return connectionRepo.findAllConnections();
}

/**
 * Updated to use ConnectionRepository
 */
export function checkWeeklyLimit(filePath, limit) {
  const count = connectionRepo.countSentInLast7Days();
  return count < limit;
}

/**
 * Generic loader for feed data
 */
export function loadFeedData(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

/**
 * Generic append for feed system
 */
export const appendAction = async (filePath, entry) => {
  if (filePath.includes('connections-sent')) {
    return appendConnection(filePath, entry);
  }

  const dir = path.dirname(filePath);
  await fsPromises.mkdir(dir, { recursive: true });

  const line = JSON.stringify({
    ...entry,
    timestamp: new Date().toISOString()
  }) + '\n';

  await fsPromises.appendFile(filePath, line);
};

export function withTimeout(promise, ms, operationName) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout exceeded: ${operationName} took longer than ${ms}ms`));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

// ─── Human-like interaction helpers ──────────────────────────────────────────

export class EmergencyStopError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EmergencyStopError';
  }
}

export async function humanType(element, text) {
  for (const char of text) {
    if (RuntimeStateService.getFlag('emergency_stop')) throw new EmergencyStopError('Emergency stop interrupted typing');
    await element.type(char);
    await new Promise(r => setTimeout(r, randomBetween(30, 130)));
  }
}

export async function humanClick(element) {
  await element.hover();
  await new Promise(r => setTimeout(r, randomBetween(200, 500)));
  await element.click();
}

export async function humanScroll(page) {
  const amount = randomBetween(300, 900);
  await page.evaluate((px) => window.scrollBy(0, px), amount);
  await randomDelay(1000, 3000);
}

export const randomDelay = async (min = 8000, max = 25000) => {
  const target = randomBetween(min, max);
  const start = Date.now();
  while (Date.now() - start < target) {
    if (RuntimeStateService.getFlag('emergency_stop')) throw new EmergencyStopError('Emergency stop interrupted delay');
    await new Promise(r => setTimeout(r, Math.min(1000, target - (Date.now() - start))));
  }
};

export function isWithinOperatingHours() {
  const hour = new Date().getHours();
  return hour >= 9 && hour < 20;
}
