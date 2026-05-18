import logger from './utils/logger.js';
import { isSessionValid, appendReviewQueue, randomDelay, humanClick, EmergencyStopError } from './utils/helpers.js';
import { visionQuery, visionClick } from './utils/vision.js';
import { RuntimeStateService } from '../backend-api/services/RuntimeStateService.js';
import { ConnectionRepository } from '../shared/repositories/ConnectionRepository.js';

const connectionRepo = new ConnectionRepository();
const INTENT_KEYWORDS = ['pricing', 'demo', 'interested', 'tell me more', "let's talk", 'book', 'calendar', 'schedule'];

export async function runReplyCheck(page, signal = null) {
  if (!(await isSessionValid(page))) {
    throw new Error('Session invalid or restricted. Aborting reply check.');
  }

  logger.info('Starting reply check...');
  let threadsProcessed = 0;

  try {
    await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'networkidle', timeout: 45000 });
    await randomDelay(4000, 8000, signal);

    // Try DOM selectors for unread threads first, fall back to vision
    const UNREAD_SELECTORS = [
      '.msg-conversation-listitem--unread',
      '[class*="conversation-listitem--unread"]',
      'li[class*="unread"]',
    ];
    let unreadThreads = [];
    for (const sel of UNREAD_SELECTORS) {
      unreadThreads = await page.$$(sel);
      if (unreadThreads.length > 0) break;
    }

    if (unreadThreads.length === 0) {
      // Vision fallback: ask Claude to identify unread conversations
      logger.info('DOM selectors found no unread threads — using vision');
      const { data, dpr } = await visionQuery(page,
        `This is the LinkedIn messaging page. Find all conversation threads that appear unread (bold name, unread indicator dot, or highlighted).
For each unread thread, return its center pixel coordinates.
Return ONLY JSON array: [{"x": <px>, "y": <px>}, ...]
If none found, return [].`
      );
      if (Array.isArray(data) && data.length > 0) {
        // Synthesise fake handles: we'll click by coordinate in the loop below
        unreadThreads = data.map(coords => ({ _visionCoords: { x: Math.round(coords.x / dpr), y: Math.round(coords.y / dpr) } }));
        logger.info(`Vision identified ${unreadThreads.length} unread thread(s)`);
      }
    }

    logger.info(`Found ${unreadThreads.length} unread threads.`);

    for (const thread of unreadThreads) {
      if (RuntimeStateService.shouldStop('reply_check') || signal?.aborted) {
        logger.info('Reply check interrupted by system signal');
        break;
      }

      if (thread._visionCoords) {
        await page.mouse.click(thread._visionCoords.x, thread._visionCoords.y);
      } else {
        await humanClick(thread, signal);
      }
      await randomDelay(2000, 4000, signal);

      // Extract profile URL — try multiple selectors
      let cleanUrl = null;
      for (const sel of ['a[href*="/in/"]', '.msg-thread__link-to-profile', 'a[data-control-name*="profile"]']) {
        const el = await page.$(sel);
        if (el) {
          const href = await el.getAttribute('href');
          if (href?.includes('/in/')) { cleanUrl = href.split('?')[0]; break; }
        }
      }
      if (!cleanUrl) {
        logger.warn('Could not find profile link in thread');
        continue;
      }

      // Extract messages — try multiple selectors
      let messages = [];
      for (const sel of ['.msg-s-event-listitem__body', '[class*="msg-s-event-listitem__body"]', '.message-item__body']) {
        messages = await page.$$(sel);
        if (messages.length > 0) break;
      }
      if (messages.length === 0) continue;

      const lastMessageElem = messages[messages.length - 1];
      const lastMessageText = await lastMessageElem.innerText();
      
      const lowerText = lastMessageText.toLowerCase();
      let interestLevel = 'low';
      let isHighIntent = false;

      for (const keyword of INTENT_KEYWORDS) {
        if (lowerText.includes(keyword)) {
          interestLevel = 'high';
          isHighIntent = true;
          break;
        }
      }

      connectionRepo.upsert(cleanUrl, 'replied', {
        repliedAt: new Date().toISOString(),
        lastMessagePreview: lastMessageText.substring(0, 100).replace(/\n/g, ' '),
        interestLevel: interestLevel,
        conversationUrl: page.url()
      });

      if (isHighIntent) {
        await appendReviewQueue({
          type: 'high_intent_reply',
          profile: cleanUrl,
          reason: `contains intent keywords in: "${lastMessageText.substring(0, 50).trim()}..."`
        });
        logger.info(`High intent detected for ${cleanUrl}`);
      }
      threadsProcessed++;
    }
    
    logger.info('Reply check complete.');
    return { recordsProcessed: threadsProcessed };
  } catch (error) {
    if (error instanceof EmergencyStopError || error.message.includes('EmergencyStopError') || error.message.includes('aborted')) {
      logger.info('Reply check workflow aborted gracefully due to emergency stop or timeout.');
      return { recordsProcessed: threadsProcessed };
    }
    logger.error('Error during reply check', { error: error.message });
    throw error;
  }
}
