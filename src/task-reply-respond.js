import logger from './utils/logger.js';
import { loadConnections, updateConnectionRecord, appendReviewQueue, randomDelay } from './utils/helpers.js';
import { generateReplyResponse } from './claude-service.js';
import path from 'path';

const CONNECTIONS_SENT_FILE = path.join(process.cwd(), 'data', 'connections-sent.json');

export async function runReplyResponse(page) {
  const connections = loadConnections(CONNECTIONS_SENT_FILE);
  // Only respond to those who replied and we haven't sent an AI response yet
  const toRespond = connections.filter(c => c.stage === 'replied' && !c.aiResponseSent);
  
  if (toRespond.length === 0) {
    logger.info('No new replies needing AI response.');
    return;
  }

  logger.info(`Found ${toRespond.length} profiles needing AI response.`);

  for (const profile of toRespond) {
    logger.info(`Processing response for ${profile.name}...`);
    try {
      if (!profile.conversationUrl) {
        logger.warn(`No conversation URL for ${profile.name}, skipping.`);
        continue;
      }

      await page.goto(profile.conversationUrl, { waitUntil: 'networkidle' });
      await randomDelay(5000, 8000);

      // Extract last message text to feed to Claude
      const messages = await page.$$('.msg-s-event-listitem__body');
      if (messages.length === 0) {
        logger.warn(`Could not find messages for ${profile.name}`);
        continue;
      }
      
      const lastMessageText = await messages[messages.length - 1].innerText();
      logger.info(`Last message from ${profile.name}: "${lastMessageText.substring(0, 50)}..."`);

      const aiResponse = await generateReplyResponse(profile, lastMessageText);

      if (aiResponse.includes('ESC_HUMAN')) {
        logger.info(`Escalating ${profile.name} to human review.`);
        await updateConnectionRecord(CONNECTIONS_SENT_FILE, profile.url, {
          stage: 'interested',
          aiResponseSent: true,
          escalatedAt: new Date().toISOString()
        });
        await appendReviewQueue({
          type: 'human_escalation',
          profile: profile.url,
          reason: 'AI requested human escalation for message: ' + lastMessageText.substring(0, 100)
        });
      } else {
        const editor = await page.$('.msg-form__contenteditable[role="textbox"]');
        if (editor) {
          await editor.click();
          await editor.type(aiResponse, { delay: 50 });
          await randomDelay(2000, 4000);
          
          const sendButton = await page.$('.msg-form__send-button');
          if (sendButton && !(await sendButton.isDisabled())) {
            await sendButton.click();
            
            await updateConnectionRecord(CONNECTIONS_SENT_FILE, profile.url, {
              stage: 'conversation_active',
              aiResponseSent: true,
              lastAiResponse: aiResponse,
              lastAiResponseAt: new Date().toISOString()
            });
            logger.info(`Successfully sent AI response to ${profile.name}`);
          } else {
            logger.warn(`Could not find enabled send button for ${profile.name}`);
          }
        } else {
          logger.warn(`Could not find message editor for ${profile.name}`);
        }
      }
    } catch (error) {
      logger.error(`Failed to process response for ${profile.name}`, { error: error.message });
    }
    await randomDelay(5000, 10000);
  }
}
