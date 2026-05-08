import express from 'express';
import { stateManager } from '../../shared/state/StateManager.js';
import { JsonRepository } from '../../shared/repositories/JsonRepository.js';
import { logAudit } from '../services/auditService.js';
import path from 'path';

const router = express.Router();
const configRepo = new JsonRepository(path.join('data', 'system-config.json'));

router.get('/', (req, res) => {
  res.json(stateManager.state);
});

router.post('/toggle/:module', async (req, res) => {
  const { module } = req.params;
  const { enabled } = req.body;
  
  const key = `${module}_enabled`;
  stateManager.setState(key, enabled);
  await configRepo.update({ [key]: enabled });
  
  await logAudit('toggle_module', { module, enabled });
  res.json({ success: true });
});

router.post('/stop', async (req, res) => {
  stateManager.setState('scheduler', 'stopped');
  await configRepo.update({ scheduler_enabled: false });
  
  await logAudit('emergency_stop', { source: 'api' });
  res.json({ success: true });
});

export default router;
