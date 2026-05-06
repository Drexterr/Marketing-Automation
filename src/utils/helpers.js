import fs from 'node:fs/promises';
import path from 'node:path';

export const randomDelay = (min = 5000, max = 15000) => {
  const delay = Math.floor(Math.random() * (max - min + 1) + min);
  return new Promise(resolve => setTimeout(resolve, delay));
};

export const logAction = async (filePath, entry) => {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  let data = [];
  try {
    const fileContent = await fs.readFile(filePath, 'utf8');
    data = JSON.parse(fileContent);
  } catch (error) {
    // File doesn't exist or is invalid JSON, start fresh
  }

  data.push({
    ...entry,
    timestamp: new Date().toISOString()
  });

  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
};

export const checkWeeklyLimit = async (filePath, limit) => {
  try {
    const fileContent = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const count = data.filter(entry => new Date(entry.timestamp) > lastWeek).length;
    return count < limit;
  } catch (error) {
    return true; // File doesn't exist or is empty
  }
};
