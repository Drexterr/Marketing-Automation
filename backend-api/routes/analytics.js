import express from 'express';
import { getAggregatedAnalytics } from '../services/analyticsService.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const data = await getAggregatedAnalytics();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
