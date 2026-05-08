import express from 'express';
import crypto from 'crypto';
import { JsonRepository } from '../../shared/repositories/JsonRepository.js';
import { hashPassword, verifyPassword, activeTokens } from '../middleware/auth.js';
import path from 'path';

const router = express.Router();
const authRepo = new JsonRepository(path.join('data', 'auth.json'));

router.post('/setup', async (req, res) => {
  const { password } = req.body;
  const config = await authRepo.findAll();
  if (config.passwordHash) {
    return res.status(400).json({ error: 'Already setup' });
  }
  await authRepo.update({ passwordHash: hashPassword(password) });
  res.json({ success: true });
});

router.post('/login', async (req, res) => {
  const { password } = req.body;
  const config = await authRepo.findAll();
  
  if (!config.passwordHash || !verifyPassword(password, config.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  activeTokens.add(token);
  res.json({ token });
});

export default router;
