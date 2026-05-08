import express from 'express';
import { NdjsonRepository } from '../../shared/repositories/NdjsonRepository.js';
import path from 'path';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const activityRepo = new NdjsonRepository(path.join('data', 'activity.ndjson'));
    const activities = await activityRepo.findAll();
    // Return last 50 events, reversed (newest first)
    res.json(activities.slice(-50).reverse());
  } catch (error) {
    res.json([]); // Return empty if file doesn't exist yet
  }
});

export default router;
