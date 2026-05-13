import express from 'express';
import { ReviewQueueRepository } from '../../shared/repositories/ReviewQueueRepository.js';

const router = express.Router();
const repo = new ReviewQueueRepository();

router.get('/', (req, res) => {
  try {
    const { category } = req.query;
    const items = repo.getPending(category);
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

router.post('/:id/acknowledge', (req, res) => {
  try {
    repo.acknowledge(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/resolve', (req, res) => {
  try {
    const { operatorNotes, response } = req.body;
    repo.resolve(req.params.id, operatorNotes, response);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/dismiss', (req, res) => {
  try {
    repo.dismiss(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
