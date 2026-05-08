/**
 * claude-service.js
 *
 * Routes all AI calls to either:
 *   CLAUDE_MODE=cli  → spawns `claude --no-markdown -p "..."` in a shell
 *   CLAUDE_MODE=web  → opens claude.ai in a Playwright tab and types the prompt
 *
 * Every exported function builds a self-contained prompt (context + task +
 * output rules) and passes it to callClaude(). The rest of the codebase calls
 * these functions exactly as before — nothing else needs to change.
 */

import logger from './utils/logger.js';
import { callCLI, testCLI } from './utils/claude-cli.js';
import { getWebClient, closeWebClient } from './utils/claude-web.js';

const MODE = (process.env.CLAUDE_MODE || 'cli').toLowerCase(); // 'cli' | 'web'

// ─── Core dispatcher ──────────────────────────────────────────────────────────

async function callClaude(prompt) {
  if (MODE === 'web') {
    const client = await getWebClient();
    return client.ask(prompt);
  }
  return callCLI(prompt);
}

// Strip markdown code fences from JSON responses
function cleanJSON(text) {
  return text.replace(/```json\n?|\n?```/g, '').trim();
}

// Shared product + audience context injected into every prompt.
function productCtx() {
  return `
CONTEXT (read before answering):
You are assisting ${process.env.FOUNDER_NAME || 'a founder'}, the founder of ${process.env.PRODUCT_NAME || 'a product'}.
Product: ${process.env.PRODUCT_DESCRIPTION || ''}

TARGET AUDIENCE:
- Primary buyers: ${process.env.ICP_PRIMARY || ''}
- Secondary (recommend/share): ${process.env.ICP_SECONDARY || ''}
- Tertiary amplifiers: ${process.env.ICP_TERTIARY || ''}
- NOT the audience: ${process.env.ICP_EXCLUDE || ''}

Core user to keep in mind: ${process.env.ICP_CORE_USER || ''}
`.trim();
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function testClaudeConnection() {
  logger.info(`Testing Claude connection (mode: ${MODE})`);
  try {
    const result = MODE === 'web'
      ? await (async () => { const c = await getWebClient(); return c.ask('Reply with exactly: connection successful'); })()
      : await testCLI();
    logger.info(`Claude connection OK: "${result.slice(0, 60)}"`);
    return result;
  } catch (error) {
    logger.error('Claude connection test failed', { message: error.message });
    throw error;
  }
}

/**
 * Score a LinkedIn profile 1–10 against the ICP.
 * Returns: { score: number, reason: string }
 */
export async function evaluateConnectionTarget(profile) {
  const prompt = `
${productCtx()}

TASK: Score this LinkedIn profile 1–10 for how likely they are to need and buy CUE AI.

SCORING TIERS:
9–10 = "Open to Work" badge OR headline says "seeking", "job hunting", "looking for role" OR fresh CS/IT grad (0–1 yr exp) OR bootcamp graduate (Masai, Newton, Scaler, GUVI, etc.) currently job hunting
7–8  = Software engineer with 1–3 years experience, no "Open to Work" but likely in job-search cycle, junior SDE at startup or product company, final year CS/IT student
6    = Career coach, placement officer, or college placement cell — amplifier who recommends tools to students
5    = General software engineer 3–5 yrs, some chance of switching roles
3–4  = Senior engineer 5+ yrs, passively open but not actively interviewing, engineering manager
1–2  = Recruiter, HR, non-tech role, sales, real estate, student in non-engineering field, 10+ yrs experience with no sign of job search

NEGATIVE SIGNALS (subtract 2 each, minimum score 1):
- Recruiter, talent acquisition, HR, staffing
- Real estate, insurance, finance sales
- No engineering or tech background
- 5+ years experience with no job-search signals
- Profile appears inactive or incomplete

PROFILE TO SCORE:
Name: ${profile.name}
Headline: ${profile.headline}
Current Company: ${profile.company || 'Unknown'}
About: ${profile.about || 'Not available'}
Open to Work: ${profile.isOpenToWork ? 'YES' : 'NO'}

OUTPUT RULE: Reply with ONLY valid JSON, no other text, no code fences:
{"score": <1-10>, "reason": "<one sentence>"}
`.trim();

  const responseText = await callClaude(prompt);
  try {
    return JSON.parse(cleanJSON(responseText));
  } catch {
    logger.error('Failed to parse score response', { responseText });
    return { score: 1, reason: 'Failed to parse AI response' };
  }
}

/**
 * Write a short LinkedIn connection note for the given profile.
 * Returns: plain text string, max 290 chars.
 */
export async function generateConnectionNote(name, headline, company = '') {
  const prompt = `
${productCtx()}

TASK: Write a LinkedIn connection request note that ${process.env.FOUNDER_NAME || 'the founder'} would send to this person.

RULES:
- Maximum 280 characters (hard limit — LinkedIn cuts off longer notes)
- Reference something SPECIFIC from their headline or company — do not be generic
- One concrete reason why connecting makes sense
- NO generic AI phrases ("excited to connect", "synergies", "leverage")
- Sound like a real human, casual and direct
- Do NOT mention the product unless it's clearly relevant
- Do NOT use salesy language

PROFILE:
Name: ${name}
Headline: ${headline}
Current Company: ${company || 'not listed'}

OUTPUT RULE: Return ONLY the note text. No quotes, no explanation.
`.trim();

  let note = await callClaude(prompt);
  // Hard trim just in case Claude ignores the character limit
  if (note.length > 290) note = note.slice(0, 287) + '...';
  return note;
}

/**
 * Check whether a LinkedIn feed post is relevant enough to comment on.
 * Returns: boolean
 */
export async function isPostRelevant(postContent) {
  const prompt = `
TASK: Decide if this LinkedIn post is relevant to the tech/startup/developer community.

RELEVANT topics: software engineering careers, coding interviews, job hunting in tech, campus placements, developer tools, AI/ML, SaaS, startup building, bootcamp experiences, engineering college life, tech hiring, switching jobs in tech, system design, DSA prep.
IRRELEVANT topics: cooking, fitness, travel, politics, sports, general motivational content, non-tech career advice, sales/marketing tips unrelated to tech.

POST:
${postContent.slice(0, 600)}

OUTPUT RULE: Reply with ONLY valid JSON, no other text:
{"relevant": true/false, "reason": "<short phrase>"}
`.trim();

  try {
    const result = await callClaude(prompt);
    const parsed = JSON.parse(cleanJSON(result));
    return parsed.relevant === true;
  } catch {
    return false; // fail-safe: skip the post
  }
}

/**
 * Generate a comment for a relevant LinkedIn feed post.
 * Returns: plain text string.
 */
export async function generateFeedComment(postContent) {
  const prompt = `
${productCtx()}

TASK: Write a LinkedIn comment on the post below, written as ${process.env.FOUNDER_NAME || 'the founder'}.

RULES:
- 1–2 sentences maximum
- Specific to this post — no generic praise
- Do NOT say "great post", "love this", "so true", or any filler
- Do NOT pitch the product or drop a link
- Do NOT ask people to DM you
- Sound like a thoughtful practitioner adding a real perspective

POST:
${postContent.slice(0, 800)}

OUTPUT RULE: Return ONLY the comment text. No quotes, no explanation.
`.trim();

  return callClaude(prompt);
}

/**
 * Generate a casual first message to send after a connection is accepted.
 * Returns: plain text string, max 400 chars.
 */
export async function generateFirstMessage(profile) {
  const prompt = `
${productCtx()}

TASK: Write the first LinkedIn message ${process.env.FOUNDER_NAME || 'the founder'} will send after this person accepted their connection request.

RULES:
- Extremely casual and conversational — like texting a new acquaintance
- NO pitching, NO selling, NO product mentions, NO links
- Maximum 400 characters
- Reference something specific from their headline or company to show you looked at their profile
- End with ONE light, easy-to-answer question that sparks a conversation
- Sound like a human engineer, not a sales rep or AI bot
- Do NOT start with "Hey [name]!" — too salesy

PROFILE:
Name: ${profile.name}
Headline: ${profile.headline}
Current Company: ${profile.company || 'not listed'}
About: ${profile.about || ''}

OUTPUT RULE: Return ONLY the message text. No quotes, no explanation.
`.trim();

  let message = await callClaude(prompt);
  if (message.length > 400) message = message.slice(0, 397) + '...';
  return message;
}

/**
 * Generate a reply to an incoming LinkedIn message.
 * Returns the reply text, OR the special string "ESC_HUMAN" if the topic
 * needs a human to handle it (pricing, enterprise, complaints, etc).
 */
export async function generateReplyResponse(profile, incomingMessage) {
  const prompt = `
${productCtx()}

TASK: Write a reply to this incoming LinkedIn message on behalf of ${process.env.FOUNDER_NAME || 'the founder'}.

PRODUCT SUMMARY FOR CONTEXT:
${process.env.PRODUCT_NAME || 'CUE AI'} is a stealthy Electron overlay that listens to system audio during a job interview, transcribes speech in real time, and injects suggested answers directly into AI chat interfaces (ChatGPT, Claude, Gemini). It helps candidates who blank out under pressure.

REPLY RULES:
- Be warm, human, and supportive — not salesy
- If they ask "what is it?" or "how does it work?", explain the value clearly and briefly
- If they express interest, enthusiasm, or ask how to try it, gently direct them to the product website or say you'll send them a link
- Maximum 500 characters
- Sound like the founder talking, not a support agent

ESCALATE TO HUMAN (reply with ONLY the word ESC_HUMAN, nothing else) if the message contains:
- Pricing or payment questions
- Enterprise / B2B / team licensing questions
- Technical bug reports
- Legal, privacy, or security concerns
- Angry or negative tone requiring careful handling
- Something completely unrelated to the product

INCOMING MESSAGE FROM ${profile.name} (${profile.headline}):
"${incomingMessage}"

OUTPUT RULE: Return ONLY the reply text, or ONLY the word ESC_HUMAN if escalating.
`.trim();

  const result = await callClaude(prompt);
  return result.trim();
}

/**
 * Generate a LinkedIn post draft about a given topic.
 * Returns: plain text string.
 */
export async function generateLinkedInPost(topic) {
  const prompt = `
${productCtx()}

TASK: Write a LinkedIn post for ${process.env.FOUNDER_NAME || 'the founder'} about the topic below.

RULES:
- 1–3 short paragraphs, each 1–3 sentences
- Authentic builder-to-builder tone — not corporate, not hype
- No buzzwords ("game-changing", "disruptive", "leverage", "synergy")
- Maximum 1000 characters
- No hashtags
- Tell a real insight, observation, or story — not a promo piece
- The product can be referenced naturally if it fits, but this is NOT an ad

TOPIC: ${topic}

OUTPUT RULE: Return ONLY the post text. No title, no explanation.
`.trim();

  return callClaude(prompt);
}

// Export the close helper so index.js can call it on shutdown
export { closeWebClient };
