import express from 'express';
import { RuntimeStateService } from '../services/RuntimeStateService.js';
import { ActivityRepository } from '../../shared/repositories/ActivityRepository.js';

const router = express.Router();
const activityRepo = new ActivityRepository();

router.get('/', (req, res) => {
  res.json(RuntimeStateService.getAllFlags());
});

router.post('/toggle/:module', async (req, res) => {
  const { module } = req.params;
  const { enabled } = req.body;
  
  const key = `${module}_enabled`;
  RuntimeStateService.setFlag(key, enabled);
  
  activityRepo.log('toggle_module', 'api', { module, enabled });
  res.json({ success: true });
});

router.post('/stop', async (req, res) => {
  RuntimeStateService.setFlag('scheduler_enabled', false);
  RuntimeStateService.emergencyStop();
  
  activityRepo.log('emergency_stop', 'api', { source: 'api' });
  res.json({ success: true });
});

export default router;
