# Structured Logging & Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance Winston logger with daily rotation, dedicated streams for Security/AI, and robust file management.

**Architecture:** Use `winston-daily-rotate-file` for all file-based transports. Implement specialized logging methods for AI and Security events. Maintain the existing `SqliteTransport`.

**Tech Stack:** Node.js, Winston, winston-daily-rotate-file

---

### Task 1: Environment Setup & Git Ignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Update .gitignore to ignore all logs**

```text
node_modules
.env
data/
logs/
.worktrees/
```

- [ ] **Step 2: Install dependencies**

Run: `node -e "require('child_process').execSync('npm install winston-daily-rotate-file', {stdio: 'inherit'})"`

- [ ] **Step 3: Commit**

```bash
git add .gitignore package.json package-lock.json
git commit -m "chore: add winston-daily-rotate-file and update gitignore"
```

### Task 2: Implement Daily Rotation and Specialized Streams

**Files:**
- Modify: `src/utils/logger.js`
- Test: `src/utils/logger.test.js`

- [ ] **Step 1: Write failing test for specialized streams**

```javascript
import { logger } from './logger.js';
import fs from 'fs';
import path from 'path';
import assert from 'node:assert';
import { test, before, after } from 'node:test';

test('logger has specialized streams', () => {
  assert.strictEqual(typeof logger.security, 'function', 'logger.security should be a function');
  assert.strictEqual(typeof logger.ai, 'function', 'logger.ai should be a function');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/utils/logger.test.js`
Expected: FAIL (logger.security is undefined)

- [ ] **Step 3: Update src/utils/logger.js with rotation and helper methods**

```javascript
import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
import { ActivityRepository } from '../../shared/repositories/ActivityRepository.js';

const logDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom transport for SQLite logging
class SqliteTransport extends winston.Transport {
  constructor(opts) {
    super(opts);
    this.activityRepo = new ActivityRepository();
  }

  log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    try {
      const { level, message, module, ...meta } = info;
      const details = { message, ...meta };
      this.activityRepo.log(level, module || 'system', details);
    } catch (err) {
      console.error('Failed to log to SQLite:', err.message);
    }
    callback();
  }
}

const commonRotationOptions = {
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d'
};

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, 'automation-%DATE%.log'),
      ...commonRotationOptions
    }),
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, 'errors-%DATE%.log'),
      level: 'error',
      ...commonRotationOptions
    }),
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, 'ai-%DATE%.log'),
      name: 'ai-log',
      level: 'info',
      ...commonRotationOptions
    }),
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, 'security-%DATE%.log'),
      name: 'security-log',
      level: 'info',
      ...commonRotationOptions
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new SqliteTransport()
  ]
});

// Helper methods for specialized logging
logger.security = (message, meta = {}) => {
  logger.info(message, { ...meta, module: 'security' });
};

logger.ai = (message, meta = {}) => {
  logger.info(message, { ...meta, module: 'ai' });
};

export default logger;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/utils/logger.test.js`
Expected: PASS

- [ ] **Step 5: Write test to verify file creation (optional but good for validation)**

```javascript
test('logger creates log files', (t, done) => {
  logger.info('Test automation log');
  logger.error('Test error log');
  logger.ai('Test AI log');
  logger.security('Test Security log');

  // Winston file logging is async, might need a small delay
  setTimeout(() => {
    const files = fs.readdirSync(logDir);
    assert(files.some(f => f.startsWith('automation-')), 'automation log file should exist');
    assert(files.some(f => f.startsWith('errors-')), 'errors log file should exist');
    assert(files.some(f => f.startsWith('ai-')), 'ai log file should exist');
    assert(files.some(f => f.startsWith('security-')), 'security log file should exist');
    done();
  }, 500);
});
```

- [ ] **Step 6: Commit**

```bash
git add src/utils/logger.js src/utils/logger.test.js
git commit -m "feat: implement structured logging with rotation and specialized streams"
```
