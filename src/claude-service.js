import Anthropic from '@anthropic-ai/sdk';
import logger from './utils/logger.js';

// Fix 6: Dotenv config removed (moved to index.js)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function testClaudeConnection() {
  try {
    logger.info('Testing Claude API connection');
    const message = await anthropic.messages.create({
      // Fix 4: Use environment variable for model
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Say "Connection successful"' }],
    });
    return message.content[0].text;
  } catch (error) {
    // Enhancement C: Improved Claude API error handling
    if (error.status === 401) {
      logger.error('Anthropic API test failed: Invalid API Key. Setup cannot continue.', {
        message: error.message
      });
    } else if (error.status === 429) {
      logger.error('Anthropic API test failed: Rate limit exceeded. Consider retrying later.', {
        message: error.message
      });
    } else {
      // Fix 8: Standardized error logging
      logger.error('Claude API test failed', {
        message: error.message,
        stack: error.stack
      });
    }
    throw error;
  }
}
