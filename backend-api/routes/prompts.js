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

// Seeding helper
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
