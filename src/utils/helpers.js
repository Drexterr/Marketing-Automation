import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

export const randomDelay = (min = 5000, max = 15000) => {
  const delay = Math.floor(Math.random() * (max - min + 1) + min);
  return new Promise(resolve => setTimeout(resolve, delay));
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
    new Date(e.timestamp).getTime() > oneWeekAgo
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
