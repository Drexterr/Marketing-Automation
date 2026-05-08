import express from 'express';
import { ActivityRepository } from '../../shared/repositories/ActivityRepository.js';

const router = express.Router();
const activityRepo = new ActivityRepository();

router.get('/', async (req, res) => {
  try {
    const activities = activityRepo.getRecent(50);
    res.json(activities);
  } catch (error) {
    res.json([]);
  }
});

export default router;
