import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

export const randomDelay = (min = 5000, max = 15000) => {
  const delay = Math.floor(Math.random() * (max - min + 1) + min);
  return new Promise(resolve => setTimeout(resolve, delay));
};

export const logAction = async (filePath, entry) => {
  const dir = path.dirname(filePath);
  await fsPromises.mkdir(dir, { recursive: true });

  let data = [];
  try {
    const fileContent = await fsPromises.readFile(filePath, 'utf8');
    data = JSON.parse(fileContent);
  } catch (error) {
    // Start fresh
  }

  data.push({
    ...entry,
    timestamp: new Date().toISOString()
  });

  await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2));
};

/**
 * Fix 2: Replace JSON array logging with NDJSON append
 */
export const appendAction = async (filePath, entry) => {
  const dir = path.dirname(filePath);
  await fsPromises.mkdir(dir, { recursive: true });

  const line = JSON.stringify({
    ...entry,
    timestamp: new Date().toISOString()
  }) + '\n';

  await fsPromises.appendFile(filePath, line);
};

/**
 * Fix 2: Replace loader for NDJSON
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

export const checkWeeklyLimit = async (filePath, limit) => {
  try {
    const fileContent = await fsPromises.readFile(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const count = data.filter(entry => new Date(entry.timestamp) > lastWeek).length;
    return count < limit;
  } catch (error) {
    return true; 
  }
};
