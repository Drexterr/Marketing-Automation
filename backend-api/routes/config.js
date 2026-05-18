import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '../../.env');

const ALLOWED_KEYS = [
  'CLAUDE_MODE', 'ANTHROPIC_API_KEY',
  'LINKEDIN_EMAIL', 'LINKEDIN_PASSWORD',
  'WEEKLY_CONNECTION_LIMIT', 'HEADLESS', 'SLOW_MO',
  'PRODUCT_NAME', 'PRODUCT_DESCRIPTION', 'FOUNDER_NAME', 'FOUNDER_ROLE',
  'TARGET_KEYWORDS',
  'ICP_PRIMARY', 'ICP_SECONDARY', 'ICP_TERTIARY', 'ICP_EXCLUDE', 'ICP_CORE_USER',
  'CRON_SCHEDULE',
];

function parseEnv(content) {
  const result = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

function updateEnvContent(content, updates) {
  const updatedKeys = new Set();
  const lines = content.split('\n').map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) return line;
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    if (key && key in updates) {
      updatedKeys.add(key);
      return `${key}=${updates[key]}`;
    }
    return line;
  });
  for (const [key, value] of Object.entries(updates)) {
    if (!updatedKeys.has(key)) {
      lines.push(`${key}=${value}`);
    }
  }
  return lines.join('\n');
}

router.get('/', (req, res) => {
  try {
    const content = fs.readFileSync(ENV_PATH, 'utf-8');
    const all = parseEnv(content);
    const config = {};
    for (const key of ALLOWED_KEYS) {
      config[key] = all[key] ?? '';
    }
    res.json(config);
  } catch {
    res.status(500).json({ error: 'Failed to read config' });
  }
});

router.post('/', (req, res) => {
  try {
    const updates = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (ALLOWED_KEYS.includes(key)) {
        updates[key] = String(value);
      }
    }
    const content = fs.readFileSync(ENV_PATH, 'utf-8');
    const updated = updateEnvContent(content, updates);
    fs.writeFileSync(ENV_PATH, updated, 'utf-8');
    for (const [key, value] of Object.entries(updates)) {
      process.env[key] = value;
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to save config' });
  }
});

export default router;
