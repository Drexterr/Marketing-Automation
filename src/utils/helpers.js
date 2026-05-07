import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

import { sendAlert } from './alerts.js';

export const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

export const randomDelay = (min = 8000, max = 25000) => {
  return new Promise(resolve => setTimeout(resolve, randomBetween(min, max)));
};

/**
 * Fix 1: Replace logAction() with NDJSON append
 */
export const appendConnection = async (filePath, entry) => {
  const dir = path.dirname(filePath);
  await fsPromises.mkdir(dir, { recursive: true });

  const line = JSON.stringify({
    ...entry,
    timestamp: new Date().toISOString()
  }) + '\n';

  await fsPromises.appendFile(filePath, line);
};

export async function getSystemState() {
  const stateFile = path.join(process.cwd(), 'data', 'system-state.json');
  try {
    const data = await fsPromises.readFile(stateFile, 'utf8');
    return JSON.parse(data);
  } catch {
    return { firstRunDate: new Date().toISOString(), currentWeek: 1 };
  }
}

export async function updateSystemState(updates) {
  const stateFile = path.join(process.cwd(), 'data', 'system-state.json');
  const currentState = await getSystemState();
  const newState = { ...currentState, ...updates };
  
  if (!currentState.firstRunDate) {
    newState.firstRunDate = new Date().toISOString();
  }

  // Calculate current week based on firstRunDate
  const firstRun = new Date(newState.firstRunDate);
  const now = new Date();
  const diffDays = Math.floor((now - firstRun) / (1000 * 60 * 60 * 24));
  newState.currentWeek = Math.floor(diffDays / 7) + 1;

  await fsPromises.writeFile(stateFile, JSON.stringify(newState, null, 2));
  return newState;
}

export async function getDynamicWeeklyLimit() {
  const state = await updateSystemState({}); // Ensure state is fresh
  const limits = [25, 30, 35, 40, 50]; // Week 1, 2, 3, 4, 5+ (Safer progression)
  return limits[Math.min(state.currentWeek - 1, limits.length - 1)];
}

export async function checkDailyLimit(filePath, maxDaily = 10) {
  const entries = loadConnections(filePath);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todayCount = entries.filter(e => 
    (e.status === 'sent' || e.status === 'accepted') && 
    new Date(e.timestamp).getTime() > startOfDay.getTime()
  ).length;

  return todayCount < maxDaily;
}

export async function appendReviewQueue(entry) {
  const logFile = path.join(process.cwd(), 'data', 'review-queue.ndjson');
  const dir = path.dirname(logFile);
  await fsPromises.mkdir(dir, { recursive: true });
  
  const line = JSON.stringify({
    ...entry,
    timestamp: new Date().toISOString()
  }) + '\n';
  
  await fsPromises.appendFile(logFile, line);
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
      await sendAlert(`LinkedIn security trigger: ${reason}. System paused.`);
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

export async function updateConnectionRecord(filePath, url, updates) {
  const entries = loadConnections(filePath);
  const updatedEntries = entries.map(e => {
    if (e.url === url) {
      return { ...e, ...updates };
    }
    return e;
  });
  
  const content = updatedEntries.map(e => JSON.stringify(e)).join('\n') + '\n';
  const tempPath = `${filePath}.tmp`;
  
  try {
    await fsPromises.writeFile(tempPath, content);
    await fsPromises.rename(tempPath, filePath);
  } catch (error) {
    try { await fsPromises.unlink(tempPath); } catch {}
    throw error;
  }
}

/**
 * Fix 1: Update loader for connections
 */
export function loadConnections(filePath) {
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
 * Fix 1: Update weekly limit check to use loadConnections
 */
export function checkWeeklyLimit(filePath, limit) {
  const entries = loadConnections(filePath);
  const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

  // Filter only 'sent' status to match weekly limit requirements if specified, 
  // but prompt just says filter entries by timestamp.
  return entries.filter(e =>
    e.status === 'sent' && new Date(e.timestamp).getTime() > oneWeekAgo
  ).length < limit;
}

/**
 * Re-using loadConnections logic for feed data to keep it consistent
 */
export function loadFeedData(filePath) {
  return loadConnections(filePath);
}

/**
 * Generic append for feed system
 */
export const appendAction = appendConnection;
