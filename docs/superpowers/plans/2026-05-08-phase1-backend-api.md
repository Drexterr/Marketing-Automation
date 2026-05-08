# Phase 1: Backend API & Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the foundational Express API, a reusable file-based Data Repository layer, and local authentication for the CUE AI Operational Control Panel.

**Architecture:** Node.js native test runner, Express.js for the API layer, native `crypto` for password hashing/session tokens, and a shared repository pattern abstracting JSON/NDJSON file access.

**Tech Stack:** Node.js (ESM), Express 5, Node `crypto`, Node `test` runner.

---

### Task 1: In-Memory State Manager

**Files:**
- Create: `shared/state/StateManager.js`
- Create: `shared/state/StateManager.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StateManager } from './StateManager.js';

test('StateManager stores and retrieves state', () => {
  const stateManager = new StateManager();
  
  assert.equal(stateManager.getState('scheduler'), 'idle');
  
  stateManager.setState('scheduler', 'running');
  assert.equal(stateManager.getState('scheduler'), 'running');
});

test('StateManager handles partial updates', () => {
  const stateManager = new StateManager();
  stateManager.updateState('metrics', { processed: 5 });
  stateManager.updateState('metrics', { failed: 1 });
  
  assert.deepEqual(stateManager.getState('metrics'), { processed: 5, failed: 1 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test shared/state/StateManager.test.js`
Expected: FAIL with "Cannot find module" or "StateManager is not defined".

- [ ] **Step 3: Write minimal implementation**

```javascript
export class StateManager {
  constructor() {
    this.state = {
      scheduler: 'idle',
      metrics: {}
    };
  }

  getState(key) {
    return this.state[key];
  }

  setState(key, value) {
    this.state[key] = value;
  }

  updateState(key, value) {
    if (typeof value === 'object' && !Array.isArray(value)) {
      this.state[key] = { ...this.state[key], ...value };
    } else {
      this.state[key] = value;
    }
  }
}

// Export a singleton instance for global access
export const stateManager = new StateManager();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test shared/state/StateManager.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/state/StateManager.js shared/state/StateManager.test.js
git commit -m "feat: add in-memory state manager for live status"
```

---

### Task 2: Base & Json Repository

**Files:**
- Create: `shared/repositories/BaseRepository.js`
- Create: `shared/repositories/JsonRepository.js`
- Create: `shared/repositories/JsonRepository.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JsonRepository } from './JsonRepository.js';
import fs from 'fs';
import path from 'path';

test('JsonRepository reads and writes JSON', async () => {
  const testFile = path.join('data', 'test-config.json');
  // Ensure clean state
  if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  if (!fs.existsSync('data')) fs.mkdirSync('data', { recursive: true });

  const repo = new JsonRepository(testFile);
  
  // Read non-existent
  const initial = await repo.findAll();
  assert.deepEqual(initial, {});

  // Create/Update
  await repo.update({ connect_enabled: true });
  const updated = await repo.findAll();
  assert.equal(updated.connect_enabled, true);

  // Cleanup
  fs.unlinkSync(testFile);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test shared/repositories/JsonRepository.test.js`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```javascript
// shared/repositories/BaseRepository.js
export class BaseRepository {
  constructor(filePath) {
    this.filePath = filePath;
  }
  async findAll() { throw new Error('Not implemented'); }
  async create(data) { throw new Error('Not implemented'); }
  async update(data) { throw new Error('Not implemented'); }
}
```

```javascript
// shared/repositories/JsonRepository.js
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { BaseRepository } from './BaseRepository.js';

export class JsonRepository extends BaseRepository {
  async findAll() {
    if (!existsSync(this.filePath)) return {};
    const content = await fs.readFile(this.filePath, 'utf-8');
    return JSON.parse(content || '{}');
  }

  async update(data) {
    const dir = path.dirname(this.filePath);
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
    const current = await this.findAll();
    const updated = { ...current, ...data };
    await fs.writeFile(this.filePath, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  }

  async create(data) {
    return this.update(data); // For JSON config, create is just update/overwrite
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test shared/repositories/JsonRepository.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/repositories/BaseRepository.js shared/repositories/JsonRepository.js shared/repositories/JsonRepository.test.js
git commit -m "feat: add Base and JSON repositories for configuration"
```

---

### Task 3: Ndjson Repository

**Files:**
- Create: `shared/repositories/NdjsonRepository.js`
- Create: `shared/repositories/NdjsonRepository.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NdjsonRepository } from './NdjsonRepository.js';
import fs from 'fs';
import path from 'path';

test('NdjsonRepository appends and reads NDJSON logs', async () => {
  const testFile = path.join('data', 'test-activity.ndjson');
  if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  
  const repo = new NdjsonRepository(testFile);
  
  await repo.create({ id: 1, action: 'connect' });
  await repo.create({ id: 2, action: 'message' });

  const items = await repo.findAll();
  assert.equal(items.length, 2);
  assert.equal(items[1].action, 'message');

  fs.unlinkSync(testFile);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test shared/repositories/NdjsonRepository.test.js`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```javascript
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { BaseRepository } from './BaseRepository.js';

export class NdjsonRepository extends BaseRepository {
  async findAll() {
    if (!existsSync(this.filePath)) return [];
    const content = await fs.readFile(this.filePath, 'utf-8');
    return content.trim().split('\n')
      .filter(line => line.length > 0)
      .map(line => JSON.parse(line));
  }

  async create(data) {
    const dir = path.dirname(this.filePath);
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
    const line = JSON.stringify(data) + '\n';
    await fs.appendFile(this.filePath, line, 'utf-8');
    return data;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test shared/repositories/NdjsonRepository.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/repositories/NdjsonRepository.js shared/repositories/NdjsonRepository.test.js
git commit -m "feat: add NDJSON repository for append-only logs"
```

---

### Task 4: Basic Express API & Auth Middleware

**Files:**
- Create: `backend-api/middleware/auth.js`
- Create: `backend-api/middleware/auth.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, authMiddleware } from './auth.js';

test('Password hashing and verification works', () => {
  const password = 'mysecurepassword';
  const hashed = hashPassword(password);
  
  assert.ok(verifyPassword(password, hashed));
  assert.equal(verifyPassword('wrong', hashed), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test backend-api/middleware/auth.test.js`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```javascript
import crypto from 'crypto';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  const [salt, key] = storedHash.split(':');
  const hashBuffer = crypto.scryptSync(password, salt, 64);
  const keyBuffer = Buffer.from(key, 'hex');
  // Use timingSafeEqual to prevent timing attacks
  const match = crypto.timingSafeEqual(hashBuffer, keyBuffer);
  return match;
}

// In-memory token store for Phase 1
export const activeTokens = new Set();

export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.session_token;
  if (!token || !activeTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test backend-api/middleware/auth.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend-api/middleware/auth.js backend-api/middleware/auth.test.js
git commit -m "feat: add authentication utilities and middleware"
```

---

### Task 5: Auth and State Routes

**Files:**
- Create: `backend-api/routes/auth.js`
- Create: `backend-api/routes/state.js`
- Create: `backend-api/server.js`

- [ ] **Step 1: Write routing and server implementation**
(No complex integration test setup required for this step, we will verify manually)

```javascript
// backend-api/routes/auth.js
import express from 'express';
import crypto from 'crypto';
import { JsonRepository } from '../../shared/repositories/JsonRepository.js';
import { hashPassword, verifyPassword, activeTokens } from '../middleware/auth.js';
import path from 'path';

const router = express.Router();
const authRepo = new JsonRepository(path.join('data', 'auth.json'));

router.post('/setup', async (req, res) => {
  const { password } = req.body;
  const config = await authRepo.findAll();
  if (config.passwordHash) {
    return res.status(400).json({ error: 'Already setup' });
  }
  await authRepo.update({ passwordHash: hashPassword(password) });
  res.json({ success: true });
});

router.post('/login', async (req, res) => {
  const { password } = req.body;
  const config = await authRepo.findAll();
  
  if (!config.passwordHash || !verifyPassword(password, config.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  activeTokens.add(token);
  res.json({ token });
});

export default router;
```

```javascript
// backend-api/routes/state.js
import express from 'express';
import { stateManager } from '../../shared/state/StateManager.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.json(stateManager.state);
});

export default router;
```

```javascript
// backend-api/server.js
import express from 'express';
import authRoutes from './routes/auth.js';
import stateRoutes from './routes/state.js';
import { authMiddleware } from './middleware/auth.js';

export function createServer() {
  const app = express();
  app.use(express.json());

  app.use('/api/auth', authRoutes);
  
  // Protected routes
  app.use('/api/state', authMiddleware, stateRoutes);

  return app;
}
```

- [ ] **Step 2: Commit**

```bash
git add backend-api/routes/auth.js backend-api/routes/state.js backend-api/server.js
git commit -m "feat: add Express routes for auth and state"
```

---

### Task 6: Unified Entry Point Integration

**Files:**
- Create: `backend-api/index.js`
- Modify: `package.json`

- [ ] **Step 1: Create the new entry point**

```javascript
// backend-api/index.js
import { createServer } from './server.js';
import { stateManager } from '../shared/state/StateManager.js';

const PORT = process.env.PORT || 3001;

async function start() {
  const app = createServer();
  
  // Indicate API is running
  stateManager.setState('api', 'running');
  stateManager.setState('scheduler', 'idle'); // placeholder until scheduler is integrated
  
  app.listen(PORT, () => {
    console.log(`Backend API running on http://localhost:${PORT}`);
  });
}

start().catch(console.error);
```

- [ ] **Step 2: Update package.json scripts**
Add the `api` script to package.json:

```json
  "scripts": {
    "start": "node index.js",
    "api": "node backend-api/index.js",
    "test": "node --test shared/**/*.test.js backend-api/**/*.test.js src/**/*.test.js"
  }
```

- [ ] **Step 3: Verify the server starts**
Run: `npm run api`
Expected: "Backend API running on http://localhost:3001"

- [ ] **Step 4: Commit**

```bash
git add backend-api/index.js package.json
git commit -m "feat: setup backend API entry point"
```
