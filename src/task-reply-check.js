import logger from './utils/logger.js';
import { isSessionValid, appendReviewQueue, randomDelay, humanClick, EmergencyStopError } from './utils/helpers.js';
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
    await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'networkidle' });
    await randomDelay(5000, 10000, signal);

    // Heuristic: finding unread message list items
    const unreadThreads = await page.$$('.msg-conversation-listitem--unread');
    
    logger.info(`Found ${unreadThreads.length} unread threads.`);

    for (const thread of unreadThreads) {
      if (RuntimeStateService.shouldStop('reply_check') || signal?.aborted) {
        logger.info('Reply check interrupted by system signal');
        break;
      }
      await humanClick(thread, signal);
      await randomDelay(2000, 4000, signal);

      // Extract details
      const profileLink = await page.$('.msg-thread__link-to-profile');
      if (!profileLink) {
        logger.warn('Could not find profile link in thread');
        continue;
      }
      
      const url = await profileLink.getAttribute('href');
      const cleanUrl = (url || '').split('?')[0];
      if (!cleanUrl) continue;
      
      const messages = await page.$$('.msg-s-event-listitem__body');
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
