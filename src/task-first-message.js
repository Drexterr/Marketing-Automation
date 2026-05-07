import logger from './utils/logger.js';
import { randomDelay, randomBetween, loadConnections, updateConnectionRecord, isSessionValid } from './utils/helpers.js';
import { generateFirstMessage } from './claude-service.js';
import path from 'path';

const CONNECTIONS_SENT_FILE = path.join(process.cwd(), 'data', 'connections-sent.json');

export async function checkAcceptedConnections(page) {
  logger.info('Checking for newly accepted connections...');
  try {
    await page.goto('https://www.linkedin.com/mynetwork/invite-connect/connections/', { waitUntil: 'networkidle' });
    await randomDelay(3000, 6000);

    const recentConnections = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('.mn-connection-card').forEach(card => {
        const link = card.querySelector('a.mn-connection-card__link');
        if (link) {
          results.push(link.href.split('?')[0]); // Clean URL
        }
      });
      return results;
    });

    const entries = loadConnections(CONNECTIONS_SENT_FILE);
    let acceptedCount = 0;

    for (const entry of entries) {
      if (entry.status === 'sent') {
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
  } catch (error) {
    logger.error('Failed to check accepted connections', { error: error.message });
  }
}

export async function runFirstMessageWorkflow(page) {
  if (!(await isSessionValid(page))) {
    throw new Error('Session expired or restricted. Aborting run.');
  }

  await checkAcceptedConnections(page);

  const entries = loadConnections(CONNECTIONS_SENT_FILE);
  const targets = entries.filter(e => e.status === 'accepted' && e.stage === 'connected');

  logger.info(`Found ${targets.length} connections ready for first message.`);

  let messagesSent = 0;
  for (const target of targets) {
    try {
      const message = await generateFirstMessage(target);
      logger.info(`Sending message to ${target.name}`);

      await page.goto(target.url, { waitUntil: 'networkidle' });
      await randomDelay(4000, 8000);

      // Try multiple ways to find the Message button
      let messageButton = await page.$('button.pvs-profile-actions__action:has-text("Message")');
      if (!messageButton) {
        messageButton = await page.$('a.pvs-profile-actions__action:has-text("Message")');
      }
      
      if (!messageButton) {
         logger.warn(`Message button not found for ${target.name}`);
         continue;
      }

      await messageButton.click();
      await randomDelay(2000, 4000);

      const editor = await page.$('div.msg-form__contenteditable');
      if (editor) {
        await editor.focus();
        await editor.fill(''); // clear if any content
        await editor.type(message, { delay: randomBetween(40, 90) }); // Randomized typing
        await randomDelay(2000, 5000);
        
        const sendBtn = await page.$('button.msg-form__send-button');
        if (sendBtn && !(await sendBtn.isDisabled())) {
          await sendBtn.click();
          await randomDelay(2000, 4000);

          await updateConnectionRecord(CONNECTIONS_SENT_FILE, target.url, {
            stage: 'first_message_sent',
            lastContact: new Date().toISOString(),
            followUpSent: false
          });
          messagesSent++;
          logger.info(`Successfully sent first message to ${target.name}`);
        } else {
          logger.warn(`Send button not enabled for ${target.name}`);
        }
      } else {
        logger.warn(`Message editor not found for ${target.name}`);
      }
      
      // Close chat bubble to avoid overlap issues
      const closeBtn = await page.$('button.msg-overlay-bubble-header__control--close-btn');
      if (closeBtn) await closeBtn.click();
      
      await randomDelay(12000, 25000); // Respectful delay between messages
    } catch (error) {
      logger.error(`Failed to send message to ${target.name}`, { error: error.message });
    }
  }
  
  logger.info(`Session Summary: Sent ${messagesSent} first messages.`);
}
