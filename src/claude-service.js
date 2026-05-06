import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import logger from './utils/logger.js';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function testClaudeConnection() {
  try {
    logger.info('Testing Claude API connection');
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Say "Connection successful"' }],
    });
    return message.content[0].text;
  } catch (error) {
    logger.error('Claude API test failed', error);
    throw error;
  }
}
