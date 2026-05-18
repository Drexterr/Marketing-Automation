import logger from './utils/logger.js';
import { randomDelay, randomBetween, isSessionValid, logSessionSummary, humanType, humanClick, EmergencyStopError } from './utils/helpers.js';
import { visionClick, visionFindEditor } from './utils/vision.js';
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

        // Try aria-label first, fall back to vision
        let msgClicked = false;
        const msgBtn = await page.$('button[aria-label*="Message" i], a[aria-label*="Message" i]');
        if (msgBtn && await msgBtn.isVisible().catch(() => false)) {
          await humanClick(msgBtn, signal);
          msgClicked = true;
        } else {
          msgClicked = await visionClick(page, `the "Message" button in the profile action buttons area`);
        }

        if (!msgClicked) {
          logger.warn(`Message button not found for ${target.name || target.profile_url}`);
          continue;
        }

        await randomDelay(2000, 4000, signal);

        // Check for existing conversation history (DOM read — reliable)
        const existingMessages = await page.$$('.msg-s-event-listitem, [class*="msg-s-event-listitem"]');
        if (existingMessages.length > 0) {
          logger.info(`Conversation already exists for ${target.name || target.profile_url} — skipping`);
          connectionRepo.upsert(target.profile_url, 'first_message_sent', {
            firstMessageSentAt: new Date().toISOString(),
            followUpSent: false
          });
          await visionClick(page, 'close button (X) on the message overlay or dialog');
          continue;
        }

        const editor = await visionFindEditor(page, 6000);
        if (editor) {
          await editor.fill?.('').catch(() => {});
          await humanType(editor, message, signal);
          await randomDelay(2000, 5000, signal);

          // Send button — try aria-label, then vision
          let sent = false;
          const sendBtn = await page.$('button[aria-label*="Send" i]:not([disabled])');
          if (sendBtn) {
            await humanClick(sendBtn, signal);
            sent = true;
          } else {
            sent = await visionClick(page, 'the enabled "Send" button for the message');
          }

          if (sent) {
            await randomDelay(2000, 4000, signal);
            connectionRepo.upsert(target.profile_url, 'first_message_sent', {
              firstMessageSentAt: new Date().toISOString(),
              followUpSent: false
            });
            messagesSent++;
          }
        }

        // Close the message overlay
        const closeBtn = await page.$('button[aria-label*="Close" i], button[aria-label*="close" i]');
        if (closeBtn) await humanClick(closeBtn, signal);
        else await visionClick(page, 'close (X) button on the message overlay');
        
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
