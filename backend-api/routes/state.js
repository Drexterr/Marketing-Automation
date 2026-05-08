import express from 'express';
import { stateManager } from '../../shared/state/StateManager.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.json(stateManager.state);
});

export default router;
