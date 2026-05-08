# Claude Service Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance `src/claude-service.js` with AI intelligence for profile evaluation, connection note generation, and feed commenting.

**Architecture:** Add three exported functions to `src/claude-service.js` that interact with the Anthropic API using structured prompts. A private helper function will be used to reduce boilerplate for Claude calls.

**Tech Stack:** Node.js, Anthropic SDK, JavaScript (ESM).

---

### Task 1: Implement Private Helper `callClaude`

**Files:**
- Modify: `src/claude-service.js`

- [ ] **Step 1: Add `callClaude` helper function**

```javascript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/claude-service.js
git commit -m "refactor: add callClaude helper to claude-service.js"
```

### Task 2: Implement `evaluateConnectionTarget`

**Files:**
- Modify: `src/claude-service.js`

- [ ] **Step 1: Add `evaluateConnectionTarget` implementation**

```javascript
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
    return JSON.parse(responseText);
  } catch (e) {
    logger.error('Failed to parse Claude evaluation response', { responseText });
    return { score: 1, reason: 'Failed to parse AI response' };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/claude-service.js
git commit -m "feat: implement evaluateConnectionTarget"
```

### Task 3: Implement `generateConnectionNote`

**Files:**
- Modify: `src/claude-service.js`

- [ ] **Step 1: Add `generateConnectionNote` implementation**

```javascript
/**
 * Generates a short, natural LinkedIn connection note.
 * @param {string} name 
 * @param {string} headline 
 * @returns {Promise<string>}
 */
export async function generateConnectionNote(name, headline) {
  const systemPrompt = `Generate a short, natural LinkedIn connection note (<300 chars) for the following person.
Goal: Founder-to-founder networking.
Tone: Natural, casual, professional, NOT salesy.
Constraints: No "I hope this finds you well", no "I'd love to add you to my network", no generic AI fluff.

Few-shot examples:
1. "Hey [Name], saw your work on [Topic] - really liked the approach you took. Would love to connect and follow your progress."
2. "Hi [Name], fellow founder here. Been following what you're building at [Company], looks super interesting. Let's connect!"
3. "[Name], your recent post about [Topic] resonated. I'm also deep in the [Industry] space. Cheers!"`;

  const userPrompt = `Profile:
Name: ${name}
Headline: ${headline}

Response should ONLY contain the note text.`;

  return await callClaude(systemPrompt, userPrompt, 150);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/claude-service.js
git commit -m "feat: implement generateConnectionNote"
```

### Task 4: Implement `generateFeedComment`

**Files:**
- Modify: `src/claude-service.js`

- [ ] **Step 1: Add `generateFeedComment` implementation**

```javascript
/**
 * Generates a short, relevant comment for a LinkedIn post.
 * @param {string} postContent 
 * @returns {Promise<string>}
 */
export async function generateFeedComment(postContent) {
  const systemPrompt = `Generate a short, relevant, and engaging comment for the following LinkedIn post.
Constraints: Short (1-2 sentences), insightful or supportive, no generic "Great post!", no AI fluff.`;

  const userPrompt = `Post Content: ${postContent}

Response should ONLY contain the comment text.`;

  return await callClaude(systemPrompt, userPrompt, 150);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/claude-service.js
git commit -m "feat: implement generateFeedComment"
```

### Task 5: Verification

**Files:**
- Create: `src/test-claude-features.js` (temporary test script)

- [ ] **Step 1: Create a test script to verify features**

```javascript
import { evaluateConnectionTarget, generateConnectionNote, generateFeedComment } from './claude-service.js';
import logger from './utils/logger.js';
import dotenv from 'dotenv';
dotenv.config();

async function runTest() {
  console.log('--- Testing evaluateConnectionTarget ---');
  const evalResult = await evaluateConnectionTarget('Jane Doe', 'Founding Engineer at TechStartup | Rust & Distributed Systems');
  console.log('Eval:', evalResult);

  console.log('\n--- Testing generateConnectionNote ---');
  const note = await generateConnectionNote('Jane Doe', 'Founding Engineer at TechStartup');
  console.log('Note:', note);

  console.log('\n--- Testing generateFeedComment ---');
  const comment = await generateFeedComment('Just launched our new open source tool for monitoring Kubernetes clusters!');
  console.log('Comment:', comment);
}

runTest().catch(console.error);
```

- [ ] **Step 2: Run verification script (Mocking Anthropic if needed, or using real API if key is present)**
Since I cannot easily mock without adding more deps, I'll rely on visual review of code and if possible run a small test.

- [ ] **Step 3: Remove test script and final commit**

```bash
rm src/test-claude-features.js
git add src/claude-service.js
git commit -m "feat: add Claude intelligence methods for profile evaluation and note generation"
```
