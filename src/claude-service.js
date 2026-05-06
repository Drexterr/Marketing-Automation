import Anthropic from '@anthropic-ai/sdk';
import logger from './utils/logger.js';

// Fix 6: Dotenv config removed (moved to index.js)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Private helper to call Claude with a system and user prompt.
 */
async function callClaude(systemPrompt, userPrompt, maxTokens = 500) {
  try {
    const response = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-3-sonnet-20240229',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    return response.content[0].text;
  } catch (error) {
    logger.error('Claude API call failed', { message: error.message });
    throw error;
  }
}

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

/**
 * Evaluates a LinkedIn profile based on name and headline against ICP.
 * @param {string} name 
 * @param {string} headline 
 * @returns {Promise<{score: number, reason: string}>}
 */
export async function evaluateConnectionTarget(name, headline) {
  const systemPrompt = `You are a lead generation expert. Evaluate the following LinkedIn profile for a networking campaign.
Target ICP: Developers, Founders, Technical roles, Engineering managers, Startup employees.
Penalize: Students, recruiters (unless technical), irrelevant industries (real estate, retail), empty or generic profiles.
Reward: Builders, open source contributors, "Founding Engineer", "CTO", "Software Architect".

Output MUST be a JSON object: { "score": 1-10, "reason": "short explanation" }`;

  const userPrompt = `Profile:
Name: ${name}
Headline: ${headline}`;

  const responseText = await callClaude(systemPrompt, userPrompt);
  try {
    // Attempt to parse JSON from the response
    const cleanedText = responseText.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanedText);
  } catch (e) {
    logger.error('Failed to parse Claude evaluation response', { responseText });
    return { score: 1, reason: 'Failed to parse AI response' };
  }
}
