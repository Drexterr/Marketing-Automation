import express from 'express';
import { ReviewQueueRepository } from '../../shared/repositories/ReviewQueueRepository.js';

const router = express.Router();
const repo = new ReviewQueueRepository();

router.get('/', (req, res) => {
  try {
    const items = repo.getPending();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id', (req, res) => {
  try {
    const { status, response } = req.body;
    repo.updateStatus(req.params.id, status, response);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
