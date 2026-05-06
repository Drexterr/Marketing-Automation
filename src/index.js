// Fix 6: Move dotenv to entry point
import dotenv from 'dotenv';
dotenv.config();

import { BrowserManager } from './browser.js';
import { testClaudeConnection } from './claude-service.js';
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
} else {
  console.log('Usage: node src/index.js setup');
}
