import logger from './utils/logger.js';
import { randomDelay, randomBetween, loadConnections, updateConnectionRecord, isSessionValid, logSessionSummary } from './utils/helpers.js';
import { generateFirstMessage } from './claude-service.js';
import { RuntimeStateService } from '../backend-api/services/RuntimeStateService.js';
import path from 'path';

const CONNECTIONS_SENT_FILE = path.join(process.cwd(), 'data', 'connections-sent.json');

export async function checkAcceptedConnections(page) {
  logger.info('Checking for newly accepted connections with pagination...');
  try {
    await page.goto('https://www.linkedin.com/mynetwork/invite-connect/connections/', { waitUntil: 'networkidle' });
    await randomDelay(3000, 6000);

    const processedUrls = new Set();
    let stagnantScrolls = 0;
    const MAX_STAGNANT_SCROLLS = 5;
    const MAX_PAGES = 10;
    let pageCount = 0;

    while (stagnantScrolls < MAX_STAGNANT_SCROLLS && pageCount < MAX_PAGES) {
      if (RuntimeStateService.shouldStop('first_message')) {
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
      await randomDelay(2000, 4000);
      pageCount++;
    }

    const recentConnections = Array.from(processedUrls);
    const entries = loadConnections(CONNECTIONS_SENT_FILE);
    let acceptedCount = 0;

    for (const entry of entries) {
      if (RuntimeStateService.shouldStop('first_message')) {
        logger.info('First message task (check-loop) interrupted by system signal');
        return acceptedCount;
      }

      if (entry.status === 'sent' || entry.status === 'request_sent') { // Check both to be safe
        const isAccepted = recentConnections.some(url => url.includes(entry.url) || entry.url.includes(url));
        if (isAccepted) {
          await updateConnectionRecord(CONNECTIONS_SENT_FILE, entry.url, {
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
    logger.error('Failed to check accepted connections', { error: error.message });
    return 0;
  }
}

export async function runFirstMessageWorkflow(page) {
  if (!(await isSessionValid(page))) {
    throw new Error('Session expired or restricted. Aborting run.');
  }

  const acceptedFound = await checkAcceptedConnections(page);

  const entries = loadConnections(CONNECTIONS_SENT_FILE);
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

  let messagesSent = 0;
  for (const target of targets) {
    if (RuntimeStateService.shouldStop('first_message')) {
      logger.info('First message task interrupted by system signal');
      break;
    }
    try {
      const message = await generateFirstMessage(target);
      
      // CRITICAL FIX 3: Intermediate state for duplicate prevention
      await updateConnectionRecord(CONNECTIONS_SENT_FILE, target.url, {
        stage: 'sending_first_message',
        messageDraftedAt: new Date().toISOString()
      });

      logger.info(`Sending message to ${target.name}`);

      await page.goto(target.url, { waitUntil: 'networkidle' });
      await randomDelay(4000, 8000);

      let messageButton = await page.$('button.pvs-profile-actions__action:has-text("Message"), a.pvs-profile-actions__action:has-text("Message")');
      
      if (!messageButton) {
         logger.warn(`Message button not found for ${target.name}`);
         continue;
      }

      await messageButton.click();
      await randomDelay(2000, 4000);

      const editor = await page.$('div.msg-form__contenteditable');
      if (editor) {
        await editor.focus();
        await editor.fill(''); 
        await editor.type(message, { delay: randomBetween(40, 90) }); 
        await randomDelay(2000, 5000);
        
        const sendBtn = await page.$('button.msg-form__send-button');
        if (sendBtn && !(await sendBtn.isDisabled())) {
          await sendBtn.click();
          await randomDelay(2000, 4000);

          await updateConnectionRecord(CONNECTIONS_SENT_FILE, target.url, {
            stage: 'first_message_sent',
            firstMessageSentAt: new Date().toISOString(),
            followUpSent: false
          });
          messagesSent++;
        }
      }
      
      const closeBtn = await page.$('button.msg-overlay-bubble-header__control--close-btn');
      if (closeBtn) await closeBtn.click();
      
      await randomDelay(12000, 25000);
    } catch (error) {
      logger.error(`Failed to send message to ${target.name}`, { error: error.message });
    }
  }
  
  await logSessionSummary({
    runType: "first_messages",
    messagesSent,
    duplicatesPrevented,
    acceptedConnectionsFound: acceptedFound
  });

  logger.info(`Session Summary: Sent ${messagesSent} first messages.`);
}
