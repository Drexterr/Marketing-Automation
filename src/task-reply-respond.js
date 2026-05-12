import logger from './utils/logger.js';
import { loadConnections, updateConnectionRecord, appendReviewQueue, randomDelay, humanType, humanClick, EmergencyStopError } from './utils/helpers.js';
import { sendAlert } from './utils/alerts.js';
import { generateReplyResponse } from './claude-service.js';
import { RuntimeStateService } from '../backend-api/services/RuntimeStateService.js';

export async function runReplyResponse(page, signal = null) {
  const connections = loadConnections(undefined);
  // Only respond to those who replied and we haven't sent an AI response yet
  const toRespond = connections.filter(c => c.stage === 'replied' && !c.aiResponseSent);
  
  if (toRespond.length === 0) {
    logger.info('No new replies needing AI response.');
    return { recordsProcessed: 0 };
  }

  logger.info(`Found ${toRespond.length} profiles needing AI response.`);
  let responsesSent = 0;

  for (const profile of toRespond) {
    if (RuntimeStateService.shouldStop('reply_response') || signal?.aborted) {
      logger.info('Reply response task interrupted by system signal');
      break;
    }
    logger.info(`Processing response for ${profile.name}...`);
    try {
      if (!profile.conversationUrl) {
        logger.warn(`No conversation URL for ${profile.name}, skipping.`);
        continue;
      }

      await page.goto(profile.conversationUrl, { waitUntil: 'networkidle' });
      await randomDelay(5000, 8000, signal);

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
        await updateConnectionRecord(undefined, profile.url, {
          stage: 'interested',
          aiResponseSent: true,
          escalatedAt: new Date().toISOString()
        });
        await appendReviewQueue({
          type: 'human_escalation',
          profile: profile.url,
          reason: 'AI requested human escalation for message: ' + lastMessageText.substring(0, 100)
        });
        await sendAlert(`🔥 *Hot Lead*! AI escalated ${profile.name} to human review: "${lastMessageText.substring(0, 50)}..."`);
        responsesSent++; // Counting escalation as a processed record
      } else {
        const editor = await page.$('.msg-form__contenteditable[role="textbox"]');
        if (editor) {
          await humanClick(editor, signal);
          await humanType(editor, aiResponse, signal);
          await randomDelay(2000, 4000, signal);
          
          const sendButton = await page.$('.msg-form__send-button');
          if (sendButton && !(await sendButton.isDisabled())) {
            await humanClick(sendButton, signal);
            
            await updateConnectionRecord(undefined, profile.url, {
              stage: 'conversation_active',
              aiResponseSent: true,
              lastAiResponse: aiResponse,
              lastAiResponseAt: new Date().toISOString()
            });
            logger.info(`Successfully sent AI response to ${profile.name}`);
            responsesSent++;
          } else {
            logger.warn(`Could not find enabled send button for ${profile.name}`);
          }
        } else {
          logger.warn(`Could not find message editor for ${profile.name}`);
        }
      }
    } catch (error) {
      if (error instanceof EmergencyStopError || error.message.includes('EmergencyStopError') || error.message.includes('aborted')) {
        logger.info('Reply response workflow aborted gracefully due to emergency stop or timeout.');
        return { recordsProcessed: responsesSent };
      }
      logger.error(`Failed to process response for ${profile.name}`, { error: error.message });
    }
    await randomDelay(5000, 10000, signal);
  }
  return { recordsProcessed: responsesSent };
}
