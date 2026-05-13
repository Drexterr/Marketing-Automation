import logger from './utils/logger.js';
import { randomDelay, randomBetween, isSessionValid, logSessionSummary, humanType, humanClick, EmergencyStopError } from './utils/helpers.js';
import { generateFirstMessage } from './claude-service.js';
import { RuntimeStateService } from '../backend-api/services/RuntimeStateService.js';
import { ConnectionRepository } from '../shared/repositories/ConnectionRepository.js';

const connectionRepo = new ConnectionRepository();

export async function checkAcceptedConnections(page, signal = null) {
  logger.info('Checking for newly accepted connections with pagination...');
  try {
    await page.goto('https://www.linkedin.com/mynetwork/invite-connect/connections/', { waitUntil: 'domcontentloaded' });
    await randomDelay(3000, 6000, signal);

    const processedUrls = new Set();
    let stagnantScrolls = 0;
    const MAX_STAGNANT_SCROLLS = 5;
    const MAX_PAGES = 10;
    let pageCount = 0;

    while (stagnantScrolls < MAX_STAGNANT_SCROLLS && pageCount < MAX_PAGES) {
      if (RuntimeStateService.shouldStop('first_message') || signal?.aborted) {
        logger.info('First message task (check) interrupted by system signal');
        return 0;
      }
      const previousSize = processedUrls.size;
      
      const newUrls = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.mn-connection-card'))
          .map(card => card.querySelector('a.mn-connection-card__link')?.href.split('?')[0])
          .filter(Boolean);
      });

      newUrls.forEach(url => processedUrls.add(url));

      if (processedUrls.size === previousSize) {
        stagnantScrolls++;
      } else {
        stagnantScrolls = 0;
      }

      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
      await randomDelay(2000, 4000, signal);
      pageCount++;
    }

    const recentConnections = Array.from(processedUrls);
    const entries = connectionRepo.findAllConnections();
    let acceptedCount = 0;

    for (const entry of entries) {
      if (RuntimeStateService.shouldStop('first_message') || signal?.aborted) {
        logger.info('First message task (check-loop) interrupted by system signal');
        return acceptedCount;
      }

      if (entry.state === 'request_sent') {
        const isAccepted = recentConnections.some(url => url.includes(entry.profile_url) || entry.profile_url.includes(url));
        if (isAccepted) {
          connectionRepo.upsert(entry.profile_url, 'connected', {
            acceptedAt: new Date().toISOString()
          });
          acceptedCount++;
        }
      }
    }
    logger.info(`Detected ${acceptedCount} newly accepted connections.`);
    return acceptedCount;
  } catch (error) {
    if (error instanceof EmergencyStopError || error.message.includes('EmergencyStopError') || error.message.includes('aborted')) {
      throw error;
    }
    logger.error('Failed to check accepted connections', { error: error.message });
    return 0;
  }
}

export async function runFirstMessageWorkflow(page, signal = null) {
  if (!(await isSessionValid(page))) {
    throw new Error('Session expired or restricted. Aborting run.');
  }

  let messagesSent = 0;
  let acceptedFound = 0;
  try {
    acceptedFound = await checkAcceptedConnections(page, signal);

    const entries = connectionRepo.findAllConnections();
    const targets = entries.filter(e => {
      if (e.state === 'first_message_sent') return false;
      
      // Duplicate Protection
      if (e.state === 'sending_first_message') {
        const draftedAt = new Date(e.messageDraftedAt || e.updated_at).getTime();
        const thirtyMinsAgo = Date.now() - (30 * 60 * 1000);
        if (draftedAt > thirtyMinsAgo) {
          return false;
        }
      }
      
      return e.state === 'connected' || e.state === 'sending_first_message';
    });

    const duplicatesPrevented = entries.filter(e => 
      e.state === 'sending_first_message' && 
      new Date(e.messageDraftedAt || e.updated_at).getTime() > (Date.now() - 30 * 60 * 1000)
    ).length;

    logger.info(`Found ${targets.length} connections ready for first message.`);

    for (const target of targets) {
      if (RuntimeStateService.shouldStop('first_message') || signal?.aborted) {
        logger.info('First message task interrupted by system signal');
        break;
      }
      try {
        const message = await generateFirstMessage(target);
        
        // Intermediate state for duplicate prevention
        connectionRepo.upsert(target.profile_url, 'sending_first_message', {
          messageDraftedAt: new Date().toISOString()
        });

        logger.info(`Sending message to ${target.name || target.profile_url}`);

        await page.goto(target.profile_url, { waitUntil: 'domcontentloaded' });
        await randomDelay(4000, 8000, signal);

        let messageButton = await page.$('button.pvs-profile-actions__action:has-text("Message"), a.pvs-profile-actions__action:has-text("Message")');
        
        if (!messageButton) {
           logger.warn(`Message button not found for ${target.name || target.profile_url}`);
           continue;
        }

        await humanClick(messageButton, signal);
        await randomDelay(2000, 4000, signal);

        const existingMessages = await page.$$('.msg-s-event-listitem');
        if (existingMessages.length > 0) {
            logger.info(`Conversation history already exists for ${target.name || target.profile_url}. Skipping first message to prevent duplicate.`);
            connectionRepo.upsert(target.profile_url, 'first_message_sent', {
              firstMessageSentAt: new Date().toISOString(),
              followUpSent: false
            });
            const closeBtn = await page.$('button.msg-overlay-bubble-header__control--close-btn');
            if (closeBtn) await humanClick(closeBtn, signal);
            continue;
        }

        const editor = await page.$('div.msg-form__contenteditable');
        if (editor) {
          await editor.focus();
          await editor.fill(''); 
          await humanType(editor, message, signal); 
          await randomDelay(2000, 5000, signal);
          
          const sendBtn = await page.$('button.msg-form__send-button');
          if (sendBtn && !(await sendBtn.isDisabled())) {
            await humanClick(sendBtn, signal);
            await randomDelay(2000, 4000, signal);

            connectionRepo.upsert(target.profile_url, 'first_message_sent', {
              firstMessageSentAt: new Date().toISOString(),
              followUpSent: false
            });
            messagesSent++;
          }
        }
        
        const closeBtn = await page.$('button.msg-overlay-bubble-header__control--close-btn');
        if (closeBtn) await humanClick(closeBtn, signal);
        
        await randomDelay(12000, 25000, signal);
      } catch (error) {
        if (error instanceof EmergencyStopError || error.message.includes('EmergencyStopError') || error.message.includes('aborted')) {
          logger.info('First message workflow aborted gracefully due to emergency stop or timeout.');
          return { recordsProcessed: messagesSent };
        }
        logger.error(`Failed to send message to ${target.name || target.profile_url}`, { error: error.message });
      }
    }
    
    await logSessionSummary({
      runType: "first_messages",
      messagesSent,
      duplicatesPrevented,
      acceptedConnectionsFound: acceptedFound
    });

  } catch (error) {
    if (error instanceof EmergencyStopError || error.message.includes('EmergencyStopError') || error.message.includes('aborted')) {
      logger.info('First message workflow aborted gracefully due to emergency stop or timeout.');
    } else {
      logger.error('First message workflow failed', { message: error.message });
    }
  }

  logger.info(`Session Summary: Sent ${messagesSent} first messages.`);
  return { recordsProcessed: messagesSent };
}
