import Anthropic from '@anthropic-ai/sdk';
import logger from './utils/logger.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Fix 4: Add retry logic to Claude API calls
 */
async function callClaude(systemPrompt, userPrompt, maxTokens = 500, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20240620',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: userPrompt }],
        system: systemPrompt
      });

      return response.content[0].text;

    } catch (error) {
      if (
        attempt === retries ||
        error.status === 401 ||
        error.status === 400
      ) {
        throw error;
      }

      logger.warn(`Claude retry ${attempt}`, {
        message: error.message
      });

      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

export async function testClaudeConnection() {
  try {
    logger.info('Testing Claude API connection');
    const message = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20240620',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Say "Connection successful"' }],
    });
    return message.content[0].text;
  } catch (error) {
    if (error.status === 401) {
      logger.error('Anthropic API test failed: Invalid API Key. Setup cannot continue.', {
        message: error.message
      });
    } else if (error.status === 429) {
      logger.error('Anthropic API test failed: Rate limit exceeded. Consider retrying later.', {
        message: error.message
      });
    } else {
      logger.error('Claude API test failed', {
        message: error.message,
        stack: error.stack
      });
    }
    throw error;
  }
}

export async function evaluateConnectionTarget(name, headline, company = '') {
  const productName = process.env.PRODUCT_NAME || 'a B2B SaaS product';
  const systemPrompt = `You are a lead generation expert for ${productName}.

Score LinkedIn profiles 1–10 against this ICP: early-stage technical founders, founding engineers, solo devs building SaaS/tools/AI products.

SCORING TIERS:
9–10: Founding Engineer, CTO at seed-stage startup, open-source maintainer, indie hacker with shipped product
7–8: Senior engineer at startup (<200 employees), technical co-founder, "Building in public" bio
5–6: Engineer at mid-size company, product manager with technical background
3–4: Engineer at enterprise (FAANG, banks), non-technical founder, recruiter
1–2: Student, HR, sales, real estate, retail, empty headline

HARD REJECT (score ≤ 2): recruiter, staffing, HR, real estate, insurance

Output ONLY valid JSON: { "score": 1-10, "reason": "one sentence" }`;

  const userPrompt = `Profile:
Name: ${name}
Headline: ${headline}
Current Company: ${company || 'Unknown'}`;

  const responseText = await callClaude(systemPrompt, userPrompt);
  try {
    const cleanedText = responseText.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanedText);
  } catch (e) {
    logger.error('Failed to parse Claude evaluation response', { responseText });
    return { score: 1, reason: 'Failed to parse AI response' };
  }
}

/**
 * Fix 1: Pass company into connection note generation
 */
export async function generateConnectionNote(name, headline, company = '') {
  const founderName = process.env.FOUNDER_NAME || 'a founder';
  const productName = process.env.PRODUCT_NAME || 'my product';
  const productDesc = process.env.PRODUCT_DESCRIPTION || '';

  const systemPrompt = `You write LinkedIn connection notes for ${founderName}, founder of ${productName} (${productDesc}).

Rules:
- Under 280 characters
- Reference something specific in their headline
- One concrete hook
- No generic AI phrases
- Sound like a real person`;

  const userPrompt = `Profile:
Name: ${name}
Headline: ${headline}
Current Company: ${company || 'not listed'}

Write a short, natural LinkedIn connection note (max 300 characters).
Be specific. Use company context if relevant.

Return ONLY the note text. No quotes.`;

  let note = await callClaude(systemPrompt, userPrompt, 150);
  if (note.length > 290) {
    note = note.slice(0, 287) + '...';
  }
  return note;
}

/**
 * Fix 3: Add product context to feed comment generation
 */
export async function generateFeedComment(postContent) {
  const founderName = process.env.FOUNDER_NAME || 'a founder';
  const productName = process.env.PRODUCT_NAME || 'a product';

  const systemPrompt = `You write LinkedIn comments as ${founderName}, founder of ${productName}.

Write 1–2 sentence comments:
- specific to the post
- no generic praise
- no "great post"
- no DM bait

Return ONLY the comment text.`;

  const userPrompt = `Post Content: ${postContent}

Response should ONLY contain the comment text.`;

  return await callClaude(systemPrompt, userPrompt, 150);
}

export async function isPostRelevant(postContent) {
  const systemPrompt = `You are a relevance filter. Reply ONLY with valid JSON: { "relevant": true/false, "reason": "one short phrase" }

Relevant = post is about: software development, AI/ML, startup building, tech products, engineering career, developer tools, SaaS.`;

  const userPrompt = `Post: ${postContent.slice(0, 600)}`;

  try {
    const result = await callClaude(systemPrompt, userPrompt, 80);
    const parsed = JSON.parse(result.replace(/```json\n?|\n?```/g, '').trim());
    return parsed.relevant === true;
  } catch {
    return false;
  }
}
