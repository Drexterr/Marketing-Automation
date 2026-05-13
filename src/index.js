// Fix 6: Move dotenv to entry point
import dotenv from 'dotenv';
dotenv.config();

import { BrowserManager } from './browser.js';
import { testClaudeConnection, closeWebClient } from './claude-service.js';
import { runConnectionWorkflow } from './task-connect.js';
import { runFeedCommenting } from './task-feed.js';
import { runFirstMessageWorkflow } from './task-first-message.js';
import { runReplyCheck } from './task-reply-check.js';
import { runReplyResponse } from './task-reply-respond.js';
import { runPostContent } from './task-post-content.js';
import { runFollowUpMarking } from './task-followups.js';
import { generateDashboardSummary } from './analytics.js';
import { runScheduler } from './scheduler.js';
import { startDashboard } from './dashboard-server.js';
import logger from './utils/logger.js';
import { getDashboardHash } from '../backend-api/middleware/auth.js';
import db from '../backend-api/db/init.js';
import { RuntimeStateService } from '../backend-api/services/RuntimeStateService.js';
import { activeBrowsers } from './browser.js';
import fs from 'node:fs';
import path from 'node:path';

async function shutdown() {
  logger.info('Initiating graceful shutdown...');
  RuntimeStateService.setFlag('emergency_stop', true);
  
  for (const manager of activeBrowsers) {
    try {
      logger.info('Closing active browser instance...');
      await manager.close();
    } catch (e) {
      logger.error('Error closing browser during shutdown', { error: e.message });
    }
  }

  const lockFile = path.join(process.cwd(), 'data', 'scheduler.lock');
  if (fs.existsSync(lockFile)) {
    try {
      fs.unlinkSync(lockFile);
      logger.info('Scheduler lock file removed.');
    } catch (e) {
      // ignore
    }
  }

  logger.info('Shutdown complete.');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export function validateConfig() {
  const requiredVars = ['CLAUDE_MODE', 'FOUNDER_NAME', 'PRODUCT_NAME'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    throw new Error(`Configuration Error: Missing required environment variables: ${missing.join(', ')}`);
  }
}

function validateSystem() {
  try {
    if (!process.env.DASHBOARD_PASSWORD) {
      throw new Error('DASHBOARD_PASSWORD not set in .env');
    }
    if (!process.env.SESSION_SECRET && !process.env.DASHBOARD_PASSWORD) {
      throw new Error('SESSION_SECRET or DASHBOARD_PASSWORD must be set for session encryption');
    }
    
    // Check for critical LinkedIn credentials
    if (!process.env.LINKEDIN_EMAIL || !process.env.LINKEDIN_PASSWORD) {
      logger.warn('LINKEDIN_EMAIL or LINKEDIN_PASSWORD not set in .env. Setup/re-login may require manual entry.');
    }

    // Check for Claude API Key if in CLI mode
    if ((process.env.CLAUDE_MODE || 'cli').toLowerCase() === 'cli' && !process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not set in .env (required for CLAUDE_MODE=cli)');
    }

    // Pre-hash password and validate it can be hashed
    getDashboardHash();

    // Check DB integrity
    db.prepare('SELECT 1').get();
    
    logger.info('System validation passed');
  } catch (error) {
    logger.error('CRITICAL: System validation failed', { error: error.message });
    process.exit(1);
  }
}

import { fileURLToPath } from 'node:url';

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  validateConfig();
  validateSystem();
}

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

async function connect(signal) {
  const browserManager = new BrowserManager();
  try {
    const page = await browserManager.launch(process.env.HEADLESS === 'true');
    const result = await runConnectionWorkflow(page);
    await generateDashboardSummary();
    return result;
  } catch (error) {
    logger.error('Connection task failed', { message: error.message, stack: error.stack });
    return { recordsProcessed: 0 };
  } finally {
    await browserManager.close();
  }
}

async function feed(signal) {
  try {
    const result = await runFeedCommenting(3);
    return result;
  } catch (error) {
    logger.error('Feed task failed', { message: error.message, stack: error.stack });
    return { recordsProcessed: 0 };
  }
}

async function firstMessage(signal) {
  const browserManager = new BrowserManager();
  try {
    const page = await browserManager.launch(process.env.HEADLESS === 'true');
    const result = await runFirstMessageWorkflow(page);
    await generateDashboardSummary();
    return result;
  } catch (error) {
    logger.error('First message task failed', { message: error.message, stack: error.stack });
    return { recordsProcessed: 0 };
  } finally {
    await browserManager.close();
  }
}

async function replies(signal) {
  const browserManager = new BrowserManager();
  try {
    const page = await browserManager.launch(process.env.HEADLESS === 'true');
    const checkResult = await runReplyCheck(page);
    const respondResult = await runReplyResponse(page);
    await generateDashboardSummary();
    
    return { 
      recordsProcessed: (checkResult?.recordsProcessed || 0) + (respondResult?.recordsProcessed || 0) 
    };
  } catch (error) {
    logger.error('Reply workflow failed', { message: error.message, stack: error.stack });
    return { recordsProcessed: 0 };
  } finally {
    await browserManager.close();
  }
}

async function followups(signal) {
  try {
    const result = await runFollowUpMarking();
    await generateDashboardSummary();
    return result;
  } catch (error) {
    logger.error('Followups task failed', { message: error.message, stack: error.stack });
    return { recordsProcessed: 0 };
  }
}

async function analytics(signal) {
  try {
    await generateDashboardSummary();
    return { recordsProcessed: 0 };
  } catch (error) {
    logger.error('Analytics task failed', { message: error.message, stack: error.stack });
    return { recordsProcessed: 0 };
  }
}

async function post(signal) {
  const browserManager = new BrowserManager();
  try {
    const page = await browserManager.launch(process.env.HEADLESS === 'true');
    const result = await runPostContent(page);
    return result;
  } catch (error) {
    logger.error('Post task failed', { message: error.message, stack: error.stack });
    return { recordsProcessed: 0 };
  } finally {
    await browserManager.close();
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
} else if (command === 'post') {
  post().catch((err) => {
    logger.error('Unhandled post error', { message: err.message, stack: err.stack });
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
  const workflows = [replies, followups, connect, feed, post, analytics];
  runScheduler(workflows).catch(err => {
    logger.error('Scheduler crashed', { message: err.message });
    process.exit(1);
  });
} else {
  console.log('Usage: node src/index.js [setup|connect|first-message|feed|post|replies|followups|analytics|schedule|dashboard]');
}

// Close the Claude web browser (no-op when CLAUDE_MODE=cli)
process.on('exit', () => closeWebClient());
