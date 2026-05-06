import { BrowserManager } from './browser.js';
import { testClaudeConnection } from './claude-service.js';
import logger from './utils/logger.js';

async function setup() {
  const browserManager = new BrowserManager();
  try {
    logger.info('Starting Phase 1 Setup...');
    
    // 1. Test Claude
    const claudeResult = await testClaudeConnection();
    logger.info(`Claude Connection: ${claudeResult}`);

    // 2. LinkedIn Login
    const page = await browserManager.launch(false); // Force visible for setup
    await page.goto('https://www.linkedin.com/login');
    
    logger.info('Please log in manually. Waiting for feed...');
    
    // Wait for the feed navigation element to appear (signaling success)
    await page.waitForSelector('#global-nav', { timeout: 0 }); 
    
    await browserManager.saveSession();
    logger.info('Session saved successfully to data/session.json');

  } catch (error) {
    logger.error('Setup failed', error);
  } finally {
    await browserManager.close();
  }
}

const command = process.argv[2];
if (command === 'setup') {
  setup();
} else {
  console.log('Usage: node src/index.js setup');
}
