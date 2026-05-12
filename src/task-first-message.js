import logger from './utils/logger.js';
import { randomDelay, randomBetween, loadConnections, updateConnectionRecord, isSessionValid, logSessionSummary, humanType, humanClick, EmergencyStopError } from './utils/helpers.js';
import { generateFirstMessage } from './claude-service.js';
import { RuntimeStateService } from '../backend-api/services/RuntimeStateService.js';

export async function checkAcceptedConnections(page, signal = null) {
  logger.info('Checking for newly accepted connections with pagination...');
  try {
    await page.goto('https://www.linkedin.com/mynetwork/invite-connect/connections/', { waitUntil: 'networkidle' });
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
    const entries = loadConnections();
    let acceptedCount = 0;

    for (const entry of entries) {
      if (RuntimeStateService.shouldStop('first_message') || signal?.aborted) {
        logger.info('First message task (check-loop) interrupted by system signal');
        return acceptedCount;
      }

      if (entry.status === 'sent' || entry.status === 'request_sent') { // Check both to be safe
        const isAccepted = recentConnections.some(url => url.includes(entry.url) || entry.url.includes(url));
        if (isAccepted) {
          await updateConnectionRecord(undefined, entry.url, {
            status: 'accepted',
            stage: 'connected',
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

    const entries = loadConnections();
    const targets = entries.filter(e => {
      if (e.status !== 'accepted') return false;
      if (e.stage === 'first_message_sent') return false;
      
      // Duplicate Protection
      if (e.stage === 'sending_first_message') {
        const draftedAt = new Date(e.messageDraftedAt || e.timestamp).getTime();
        const thirtyMinsAgo = Date.now() - (30 * 60 * 1000);
        if (draftedAt > thirtyMinsAgo) {
          return false;
        }
      }
      
      return e.stage === 'connected' || e.stage === 'sending_first_message';
    });

    const duplicatesPrevented = entries.filter(e => 
      e.status === 'accepted' && 
      e.stage === 'sending_first_message' && 
      new Date(e.messageDraftedAt || e.timestamp).getTime() > (Date.now() - 30 * 60 * 1000)
    ).length;

    logger.info(`Found ${targets.length} connections ready for first message.`);

    for (const target of targets) {
      if (RuntimeStateService.shouldStop('first_message') || signal?.aborted) {
        logger.info('First message task interrupted by system signal');
        break;
      }
      try {
        const message = await generateFirstMessage(target);
        
        // CRITICAL FIX 3: Intermediate state for duplicate prevention
        await updateConnectionRecord(undefined, target.url, {
          stage: 'sending_first_message',
          messageDraftedAt: new Date().toISOString()
        });

        logger.info(`Sending message to ${target.name}`);

        await page.goto(target.url, { waitUntil: 'networkidle' });
        await randomDelay(4000, 8000, signal);

        let messageButton = await page.$('button.pvs-profile-actions__action:has-text("Message"), a.pvs-profile-actions__action:has-text("Message")');
        
        if (!messageButton) {
           logger.warn(`Message button not found for ${target.name}`);
           continue;
        }

        await humanClick(messageButton, signal);
        await randomDelay(2000, 4000, signal);

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

            await updateConnectionRecord(undefined, target.url, {
              stage: 'first_message_sent',
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
        logger.error(`Failed to send message to ${target.name}`, { error: error.message });
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
