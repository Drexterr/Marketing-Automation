// Fix 6: Move dotenv to entry point
import dotenv from 'dotenv';
dotenv.config();

import { BrowserManager } from './browser.js';
import { testClaudeConnection } from './claude-service.js';
import { runConnectionWorkflow } from './task-connect.js';
import { runFeedCommenting } from './task-feed.js';
import { runFirstMessageWorkflow } from './task-first-message.js';
import { runReplyCheck } from './task-reply-check.js';
import { runReplyResponse } from './task-reply-respond.js';
import { runFollowUpMarking } from './task-followups.js';
import { generateDashboardSummary } from './analytics.js';
import { runScheduler } from './scheduler.js';
import { startDashboard } from './dashboard-server.js';
import logger from './utils/logger.js';

async function setup() {
  const browserManager = new BrowserManager();
  let heartbeat;
  
  try {
    logger.info('Starting Phase 1 Setup...');
    
    // 1. Test Claude
    const claudeResult = await testClaudeConnection();
    logger.info(`Claude Connection: ${claudeResult}`);

    // 2. LinkedIn Login
    const page = await browserManager.launch(false); // Force visible for setup
    await page.goto('https://www.linkedin.com/login');
    
    logger.info('Please log in manually. Waiting for feed...');
    
    // Enhancement A: Login wait heartbeat
    heartbeat = setInterval(() => {
      logger.info('Waiting for LinkedIn login...');
    }, 30000);

    // Fix 7: Replace fragile selector with URL check
    await page.waitForURL('**/feed/**', { timeout: 0 }); 
    
    clearInterval(heartbeat);
    
    await browserManager.saveSession();
    logger.info('Session saved successfully to data/session.json');

  } catch (error) {
    if (heartbeat) clearInterval(heartbeat);
    // Fix 8: Standardized error logging
    logger.error('Setup failed', {
      message: error.message,
      stack: error.stack
    });
    // Fix 3: Rethrow so caller can handle exit
    throw error;
  } finally {
    await browserManager.close();
  }
}

async function connect() {
  const browserManager = new BrowserManager();
  try {
    const page = await browserManager.launch(process.env.HEADLESS === 'true');
    await runConnectionWorkflow(page);
    await generateDashboardSummary();
  } catch (error) {
    logger.error('Connection task failed', { message: error.message, stack: error.stack });
  } finally {
    await browserManager.close();
  }
}

async function feed() {
  try {
    await runFeedCommenting(3);
  } catch (error) {
    logger.error('Feed task failed', { message: error.message, stack: error.stack });
  }
}

async function firstMessage() {
  const browserManager = new BrowserManager();
  try {
    const page = await browserManager.launch(process.env.HEADLESS === 'true');
    await runFirstMessageWorkflow(page);
    await generateDashboardSummary();
  } catch (error) {
    logger.error('First message task failed', { message: error.message, stack: error.stack });
  } finally {
    await browserManager.close();
  }
}

async function replies() {
  const browserManager = new BrowserManager();
  try {
    const page = await browserManager.launch(process.env.HEADLESS === 'true');
    await runReplyCheck(page);
    await runReplyResponse(page);
    await generateDashboardSummary();
  } catch (error) {
    logger.error('Reply workflow failed', { message: error.message, stack: error.stack });
  } finally {
    await browserManager.close();
  }
}

async function followups() {
  try {
    await runFollowUpMarking();
    await generateDashboardSummary();
  } catch (error) {
    logger.error('Followups task failed', { message: error.message, stack: error.stack });
  }
}

async function analytics() {
  try {
    await generateDashboardSummary();
  } catch (error) {
    logger.error('Analytics task failed', { message: error.message, stack: error.stack });
  }
}

const command = process.argv[2];
if (command === 'setup') {
  // Fix 3: Fix unhandled async in CLI entry
  setup().catch((err) => {
    logger.error('Unhandled setup error', {
      message: err.message,
      stack: err.stack
    });
    process.exit(1);
  });
} else if (command === 'connect') {
  connect().catch((err) => {
    logger.error('Unhandled connect error', { message: err.message, stack: err.stack });
    process.exit(1);
  });
} else if (command === 'feed') {
  feed().catch((err) => {
    logger.error('Unhandled feed error', { message: err.message, stack: err.stack });
    process.exit(1);
  });
} else if (command === 'first-message') {
  firstMessage().catch((err) => {
    logger.error('Unhandled first message error', { message: err.message, stack: err.stack });
    process.exit(1);
  });
} else if (command === 'replies') {
  replies().catch((err) => {
    logger.error('Unhandled replies error', { message: err.message, stack: err.stack });
    process.exit(1);
  });
} else if (command === 'followups') {
  followups().catch((err) => {
    logger.error('Unhandled followups error', { message: err.message, stack: err.stack });
    process.exit(1);
  });
} else if (command === 'analytics') {
  analytics().catch((err) => {
    logger.error('Unhandled analytics error', { message: err.message, stack: err.stack });
    process.exit(1);
  });
} else if (command === 'dashboard') {
  startDashboard();
} else if (command === 'schedule') {
  const workflows = [replies, followups, connect, feed, analytics];
  runScheduler(workflows).catch(err => {
    logger.error('Scheduler crashed', { message: err.message });
    process.exit(1);
  });
} else {
  console.log('Usage: node src/index.js [setup|connect|first-message|feed|replies|followups|analytics|schedule]');
}
