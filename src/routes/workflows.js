import express from 'express';
import { fork } from 'child_process';
import path from 'path';
import { RuntimeStateService } from '../../backend-api/services/RuntimeStateService.js';
import logger from '../utils/logger.js';
import fs from 'node:fs';

const router = express.Router();
const VALID_MODULES = [
  'connect', 'first-message', 'replies', 'followups', 'feed', 'post', 'analytics'
];

// Map to keep track of running workflow processes
const activeWorkflows = new Map();

router.get('/status', (req, res) => {
  const pulse = RuntimeStateService.getPulse();
  const statuses = VALID_MODULES.map(module => {
    return {
      name: module,
      status: activeWorkflows.has(module) ? 'RUNNING' : 'IDLE',
      lastRunTime: pulse.activeTask === module ? pulse.lastHeartbeat : 'Unknown',
      // Additional stats could be fetched from DB here
    };
  });
  
  res.json({ workflows: statuses });
});

router.post('/:name/start', (req, res) => {
  const { name } = req.params;
  
  if (!VALID_MODULES.includes(name)) {
    return res.status(400).json({ error: 'Invalid workflow name' });
  }

  if (RuntimeStateService.getFlag('emergency_stop')) {
    return res.status(403).json({ error: 'System is in emergency stop mode' });
  }

  if (activeWorkflows.has(name)) {
    return res.status(409).json({ error: 'Workflow is already running' });
  }
  
  // Check scheduler lock
  const lockFile = path.join(process.cwd(), 'data', 'scheduler.lock');
  if (fs.existsSync(lockFile)) {
    return res.status(409).json({ error: 'Scheduler is currently holding the lock' });
  }

  logger.info(`Manual trigger: starting workflow ${name}`);
  RuntimeStateService.setPulse({ status: 'RUNNING', activeTask: name });

  const b = req.body || {};
  const extraEnv = {};

  if (name === 'connect') {
    if (b.targetKeywords) extraEnv.TARGET_KEYWORDS = String(b.targetKeywords);
    if (b.targetTitles)   extraEnv.TARGET_TITLES   = String(b.targetTitles);
    if (b.maxPerWeek)     extraEnv.WEEKLY_CONNECTION_LIMIT = String(Number(b.maxPerWeek));
  }
  if (name === 'feed') {
    if (b.maxPerSession)  extraEnv.FEED_MAX_PER_SESSION  = String(Number(b.maxPerSession));
    if (b.topicKeywords)  extraEnv.FEED_TOPIC_KEYWORDS   = String(b.topicKeywords);
  }
  if (name === 'first-message') {
    if (b.tone)           extraEnv.FIRST_MESSAGE_TONE    = String(b.tone);
  }
  if (name === 'replies') {
    if (b.mode)           extraEnv.REPLY_MODE            = String(b.mode);
  }
  if (name === 'followups') {
    if (b.intervalDays)   extraEnv.FOLLOWUP_INTERVAL_DAYS = String(Number(b.intervalDays));
  }
  if (name === 'post') {
    if (b.frequency)      extraEnv.POST_FREQUENCY        = String(b.frequency);
  }

  // Start the workflow as a child process to avoid blocking the event loop
  const child = fork(path.join(process.cwd(), 'src', 'index.js'), [name], {
    env: { ...process.env, DASHBOARD_TRIGGERED: 'true', ...extraEnv }
  });

  activeWorkflows.set(name, child);

  child.on('exit', (code) => {
    activeWorkflows.delete(name);
    logger.info(`Workflow ${name} exited with code ${code}`);
    RuntimeStateService.setPulse({ status: 'IDLE', activeTask: null });
  });

  child.on('error', (err) => {
    logger.error(`Workflow ${name} error`, { error: err.message });
  });

  res.json({ success: true, message: `Workflow ${name} started` });
});

router.post('/:name/stop', (req, res) => {
  const { name } = req.params;

  if (!VALID_MODULES.includes(name)) {
    return res.status(400).json({ error: 'Invalid workflow name' });
  }

  const child = activeWorkflows.get(name);
  if (child) {
    logger.info(`Manual trigger: stopping workflow ${name}`);
    child.kill('SIGINT'); // Graceful shutdown
    activeWorkflows.delete(name);
    RuntimeStateService.setPulse({ status: 'IDLE', activeTask: null });
    return res.json({ success: true, message: `Workflow ${name} stopped` });
  }

  res.status(404).json({ error: 'Workflow is not currently running' });
});

export default router;
