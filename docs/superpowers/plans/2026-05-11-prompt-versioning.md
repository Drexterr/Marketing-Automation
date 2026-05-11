# Prompt Versioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a prompt versioning system using the `prompt_versions` table in SQLite.

**Architecture:** Extend `SqliteRepository` to create `PromptRepository` for managing multiple versions of prompts. Update API routes to expose history and rollback features.

**Tech Stack:** Node.js, Express, better-sqlite3

---

### Task 1: PromptRepository Implementation

**Files:**
- Create: `.worktrees/orchestration-refactor/shared/repositories/PromptRepository.js`
- Create: `.worktrees/orchestration-refactor/shared/repositories/PromptRepository.test.js`

- [ ] **Step 1: Write the failing test for PromptRepository**

```javascript
import { PromptRepository } from './PromptRepository.js';
import db from '../../backend-api/db/init.js';

describe('PromptRepository', () => {
    let repo;

    beforeEach(() => {
        db.prepare('DELETE FROM prompt_versions').run();
        repo = new PromptRepository();
    });

    test('saveVersion should increment version and save content', () => {
        repo.saveVersion('test-key', 'content v1');
        const v1 = repo.getLatest('test-key');
        expect(v1.version).toBe(1);
        expect(v1.content).toBe('content v1');

        repo.saveVersion('test-key', 'content v2');
        const v2 = repo.getLatest('test-key');
        expect(v2.version).toBe(2);
        expect(v2.content).toBe('content v2');
    });

    test('getHistory should return all versions newest first', () => {
        repo.saveVersion('test-key', 'v1');
        repo.saveVersion('test-key', 'v2');
        const history = repo.getHistory('test-key');
        expect(history.length).toBe(2);
        expect(history[0].version).toBe(2);
        expect(history[1].version).toBe(1);
    });

    test('rollback should create a new version with old content', () => {
        repo.saveVersion('test-key', 'v1');
        repo.saveVersion('test-key', 'v2');
        const v1 = repo.getHistory('test-key')[1];
        
        repo.rollback('test-key', v1.id);
        const latest = repo.getLatest('test-key');
        expect(latest.version).toBe(3);
        expect(latest.content).toBe('v1');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test shared/repositories/PromptRepository.test.js` (or equivalent test command)

- [ ] **Step 3: Implement PromptRepository**

```javascript
import { SqliteRepository } from './SqliteRepository.js';

export class PromptRepository extends SqliteRepository {
    constructor() {
        super('prompt_versions');
    }

    saveVersion(key, content) {
        const last = this.db.prepare(
            `SELECT MAX(version) as lastVersion FROM prompt_versions WHERE key = ?`
        ).get(key);
        
        const nextVersion = (last?.lastVersion || 0) + 1;
        
        return this.create({
            key,
            version: nextVersion,
            content
        });
    }

    getHistory(key) {
        return this.db.prepare(
            `SELECT * FROM prompt_versions WHERE key = ? ORDER BY version DESC`
        ).all(key);
    }

    getLatest(key) {
        return this.db.prepare(
            `SELECT * FROM prompt_versions WHERE key = ? ORDER BY version DESC LIMIT 1`
        ).get(key);
    }

    getAllLatest() {
        return this.db.prepare(`
            SELECT p1.*
            FROM prompt_versions p1
            INNER JOIN (
                SELECT key, MAX(version) as max_v
                FROM prompt_versions
                GROUP BY key
            ) p2 ON p1.key = p2.key AND p1.version = p2.max_v
        `).all();
    }

    rollback(key, versionId) {
        const oldVersion = this.findById(versionId);
        if (!oldVersion) throw new Error('Version not found');
        return this.saveVersion(key, oldVersion.content);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add .worktrees/orchestration-refactor/shared/repositories/PromptRepository.js .worktrees/orchestration-refactor/shared/repositories/PromptRepository.test.js
git commit -m "feat: implement PromptRepository with versioning"
```

---

### Task 2: Update Prompt Routes

**Files:**
- Modify: `.worktrees/orchestration-refactor/backend-api/routes/prompts.js`

- [ ] **Step 1: Replace JsonRepository with PromptRepository**

```javascript
import express from 'express';
import { PromptRepository } from '../../shared/repositories/PromptRepository.js';
import { logAudit } from '../services/auditService.js';

const router = express.Router();
const promptRepo = new PromptRepository();

const DEFAULT_PROMPTS = {
  connection_note: "Write a short LinkedIn connection request note for {{name}} who works at {{company}}.",
  first_message: "Write a casual first message to {{name}} after they accepted my connection request.",
  feed_comment: "Write a 1-2 sentence thoughtful comment on this post: {{postContent}}",     
  auto_reply: "Write a supportive, non-salesy reply to this message: {{message}}",
  post_generation: "Generate a LinkedIn post about {{topic}} in a builder-to-builder tone."  
};

// Seeding helper (could be moved to init but here for simplicity)
async function ensureDefaultPrompts() {
    const existing = await promptRepo.getAllLatest();
    if (existing.length === 0) {
        for (const [key, content] of Object.entries(DEFAULT_PROMPTS)) {
            await promptRepo.saveVersion(key, content);
        }
    }
}

router.get('/', async (req, res) => {
  try {
    await ensureDefaultPrompts();
    const prompts = await promptRepo.getAllLatest();
    // Convert to flat object for compatibility
    const promptMap = prompts.reduce((acc, p) => {
        acc[p.key] = p.content;
        return acc;
    }, {});
    res.json(promptMap);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const updatedPrompts = req.body;
    if (typeof updatedPrompts !== 'object' || Array.isArray(updatedPrompts)) {
      return res.status(400).json({ error: 'Invalid prompt data' });
    }

    for (const [key, content] of Object.entries(updatedPrompts)) {
        await promptRepo.saveVersion(key, content);
    }
    
    await logAudit('update_prompts_batch', { keys: Object.keys(updatedPrompts) });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:key/history', async (req, res) => {
    try {
        const history = await promptRepo.getHistory(req.params.key);
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/:key', async (req, res) => {
    try {
        const { content } = req.body;
        await promptRepo.saveVersion(req.params.key, content);
        await logAudit('update_prompt', { key: req.params.key });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/:key/rollback/:versionId', async (req, res) => {
    try {
        await promptRepo.rollback(req.params.key, req.params.versionId);
        await logAudit('rollback_prompt', { key: req.params.key, versionId: req.params.versionId });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add .worktrees/orchestration-refactor/backend-api/routes/prompts.js
git commit -m "feat: expose prompt versioning via API routes"
```
