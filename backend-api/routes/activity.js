import express from 'express';
import { ActivityRepository } from '../../shared/repositories/ActivityRepository.js';

const router = express.Router();
const activityRepo = new ActivityRepository();

router.get('/', async (req, res) => {
  try {
    const rows = activityRepo.getRecent(50);
    const activities = rows.map(row => {
      let details = {};
      try { details = row.details ? JSON.parse(row.details) : {}; } catch {}
      return {
        action: row.event_type || 'System event',
        profile: details.name || details.profile || null,
        status: details.status || (row.event_type?.includes('fail') || row.event_type?.includes('error') ? 'failure' : 'info'),
        timestamp: row.timestamp || row.created_at,
        module: row.module,
        details,
      };
    });
    res.json(activities);
  } catch (error) {
    res.json([]);
  }
});

export default router;
