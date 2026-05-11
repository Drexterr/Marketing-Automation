import logger from './utils/logger.js';
import { isSessionValid, loadConnections, updateConnectionRecord, appendReviewQueue, randomDelay } from './utils/helpers.js';

const INTENT_KEYWORDS = ['pricing', 'demo', 'interested', 'tell me more', "let's talk", 'book', 'calendar', 'schedule'];

export async function runReplyCheck(page) {
  if (!(await isSessionValid(page))) {
    throw new Error('Session invalid or restricted. Aborting reply check.');
  }

  logger.info('Starting reply check...');
  
  try {
    await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'networkidle' });
    await randomDelay(5000, 10000);

    // Heuristic: finding unread message list items
    const unreadThreads = await page.$$('.msg-conversation-listitem--unread');
    
    logger.info(`Found ${unreadThreads.length} unread threads.`);

    for (const thread of unreadThreads) {
      await thread.click();
      await randomDelay(2000, 4000);

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

      await updateConnectionRecord(undefined, cleanUrl, {
        stage: 'replied',
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
    }
    
    logger.info('Reply check complete.');
  } catch (error) {
    logger.error('Error during reply check', { error: error.message });
    throw error;
  }
}
