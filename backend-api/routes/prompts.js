import express from 'express';
import { JsonRepository } from '../../shared/repositories/JsonRepository.js';
import { logAudit } from '../services/auditService.js';
import path from 'path';

const router = express.Router();
const promptRepo = new JsonRepository(path.join('data', 'prompts.json'));

const DEFAULT_PROMPTS = {
  connection_note: "Write a short LinkedIn connection request note for {{name}} who works at {{company}}.",
  first_message: "Write a casual first message to {{name}} after they accepted my connection request.",
  feed_comment: "Write a 1-2 sentence thoughtful comment on this post: {{postContent}}",
  auto_reply: "Write a supportive, non-salesy reply to this message: {{message}}",
  post_generation: "Generate a LinkedIn post about {{topic}} in a builder-to-builder tone."
};

router.get('/', async (req, res) => {
  try {
    const prompts = await promptRepo.findAll();
    if (Object.keys(prompts).length === 0) {
      return res.json(DEFAULT_PROMPTS);
    }
    res.json(prompts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const updatedPrompts = req.body;
    
    // Simple validation: ensure it's an object
    if (typeof updatedPrompts !== 'object' || Array.isArray(updatedPrompts)) {
      return res.status(400).json({ error: 'Invalid prompt data' });
    }

    await promptRepo.update(updatedPrompts);
    await logAudit('update_prompts', { keys: Object.keys(updatedPrompts) });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
