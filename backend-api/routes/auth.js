import express from 'express';
import crypto from 'crypto';
import { JsonRepository } from '../../shared/repositories/JsonRepository.js';
import { hashPassword, verifyPassword, activeTokens, getDashboardHash } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';
import { authRateLimiter } from '../middleware/security.js';
import path from 'path';
import logger from '../../src/utils/logger.js';

const router = express.Router();

router.post('/login', authRateLimiter, async (req, res) => {
  const { password } = req.body;
  
  try {
    const dashboardHash = getDashboardHash();

    if (!verifyPassword(password, dashboardHash)) {
      await logAudit('auth_failure', { reason: 'invalid_password' });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    activeTokens.set(token, expiry);

    await logAudit('auth_success', { action: 'login' });

    res.cookie('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Login error', { error: error.message });
    res.status(500).json({ error: 'Server configuration error' });
  }
});

router.post('/logout', authRateLimiter, (req, res) => {
  const token = req.cookies?.session_token;
  if (token) {
    activeTokens.delete(token);
    res.clearCookie('session_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
  }
  res.json({ success: true });
});

export default router;
