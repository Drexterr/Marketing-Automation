import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PRODUCT_CONTEXT = `
Product: ${process.env.PRODUCT_NAME || "CUE AI"}
Description: ${process.env.PRODUCT_DESCRIPTION || "A stealthy, always-on-top Electron overlay that listens to your system audio, transcribes speech in real time, and injects interview prompts directly into AI chat interfaces (ChatGPT, Claude, Gemini, DeepSeek)."}
Founder: ${process.env.FOUNDER_NAME || "Founder"} (${process.env.FOUNDER_ROLE || "Founder"})
`;

/**
 * Determine if a LinkedIn profile is a good connection target for CUE AI
 */
export async function evaluateConnectionTarget(profile) {
  const prompt = `You are the founder of CUE AI evaluating LinkedIn profiles for outreach.

${PRODUCT_CONTEXT}

CUE AI target audience: Software engineers, developers, tech leads, engineering managers, product managers, startup founders, recruiters, HR professionals, and anyone who does technical interviews or is job hunting.

Profile to evaluate:
Name: ${profile.name}
Headline: ${profile.headline}
Location: ${profile.location || "Unknown"}
About: ${profile.about || "Not available"}
Mutual connections: ${profile.mutualConnections || 0}

Should we send a connection request to this person? Consider:
1. Are they likely to benefit from or be interested in CUE AI?
2. Are they in tech, recruiting, or job hunting space?
3. Is their profile relevant?

Respond with JSON only: {"connect": true/false, "reason": "brief reason", "score": 1-10}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });

  try {
    const text = response.content[0].text.trim();
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return { connect: false, reason: "Parse error", score: 0 };
  }
}

/**
 * Generate a personalized connection note
 */
export async function generateConnectionNote(profile) {
  const prompt = `You are the founder of CUE AI sending a LinkedIn connection request.

${PRODUCT_CONTEXT}

Write a SHORT, friendly, personalized connection note (max 200 characters for LinkedIn limit). 
- Sound human, not salesy
- Reference something specific about their profile
- Optionally briefly mention CUE AI if it's naturally relevant
- No emojis overload, keep it professional but warm

Profile:
Name: ${profile.name}
Headline: ${profile.headline}
About: ${profile.about || "Not provided"}

Return ONLY the note text, nothing else.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 100,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].text.trim();
}

/**
 * Generate a personalized reply to a LinkedIn message
 */
export async function generateMessageReply(conversation) {
  const prompt = `You are the founder of CUE AI replying to a LinkedIn message.

${PRODUCT_CONTEXT}

Conversation history:
${conversation.messages
  .map((m) => `${m.sender}: ${m.text}`)
  .join("\n")}

Person's profile:
Name: ${conversation.senderName}
Headline: ${conversation.senderHeadline || "Unknown"}

Write a natural, personalized reply that:
- Directly addresses what they said
- Is friendly and conversational
- If they seem interested in CUE AI, share relevant info naturally
- If it's a cold message or question about the product, engage genuinely
- Keep it concise (2-4 sentences max)
- Do NOT be pushy or salesy

Return ONLY the reply text.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].text.trim();
}

/**
 * Generate a personalized first message to a new connection
 */
export async function generateFirstMessage(profile) {
  const prompt = `You are the founder of CUE AI sending a first message to a new LinkedIn connection.

${PRODUCT_CONTEXT}

New connection profile:
Name: ${profile.name}
Headline: ${profile.headline}
About: ${profile.about || "Not provided"}
Recent activity: ${profile.recentActivity || "Not available"}

Write a warm, personalized opening message:
- Start with something genuine about their work/background
- Briefly introduce yourself and CUE AI in context
- End with a soft, non-pushy question or call to action
- Keep it under 150 words
- Sound like a real person, not a bot

Return ONLY the message text.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 250,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].text.trim();
}

/**
 * Evaluate and generate a comment for a LinkedIn post
 */
export async function generateFeedComment(post) {
  const prompt = `You are the founder of CUE AI engaging with LinkedIn posts.

${PRODUCT_CONTEXT}

Post details:
Author: ${post.author}
Author headline: ${post.authorHeadline || "Unknown"}
Post content: ${post.content}

First, decide if this post is worth commenting on (score 1-10):
- High value: posts about interviews, job searching, developer tools, AI tools, productivity, tech hiring, software development
- Medium value: general tech, startup journey, leadership posts
- Low value: purely personal, unrelated industries, political

Then write a genuine comment if score >= 6:
- Be insightful and add value to the conversation
- Reference specific points from the post
- Optionally and naturally mention CUE AI ONLY if it's directly relevant (don't force it)
- 1-3 sentences, engaging and professional
- Sound human, not promotional

Respond with JSON only: {"score": 1-10, "comment": "comment text or null if not worth commenting", "reason": "brief reason"}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  try {
    const text = response.content[0].text.trim();
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return { score: 0, comment: null, reason: "Parse error" };
  }
}
