import logger from './utils/logger.js';
import { appendReviewQueue, randomDelay, humanType, humanClick, EmergencyStopError } from './utils/helpers.js';
import { sendAlert } from './utils/alerts.js';
import { generateReplyResponse } from './claude-service.js';
import { RuntimeStateService } from '../backend-api/services/RuntimeStateService.js';
import { ConnectionRepository } from '../shared/repositories/ConnectionRepository.js';

const connectionRepo = new ConnectionRepository();

export async function runReplyResponse(page, signal = null) {
  const connections = connectionRepo.findAllConnections();
  // Only respond to those who replied and we haven't sent an AI response yet
  const toRespond = connections.filter(c => {
    if (c.state === 'conversation_active' || c.aiResponseSent) return false;
    if (c.state === 'sending_reply') {
      const draftedAt = new Date(c.aiResponseDraftedAt || c.updated_at).getTime();
      if (Date.now() - draftedAt < 30 * 60 * 1000) return false; // Currently in progress
    }
    return c.state === 'replied' || c.state === 'sending_reply';
  });
  
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
    logger.info(`Processing response for ${profile.name || profile.profile_url}...`);
    try {
      if (!profile.conversationUrl) {
        logger.warn(`No conversation URL for ${profile.profile_url}, skipping.`);
        continue;
      }

      await page.goto(profile.conversationUrl, { waitUntil: 'domcontentloaded' });
      await randomDelay(5000, 8000, signal);

      // Extract last message text to feed to Claude
      const messages = await page.$$('.msg-s-event-listitem__body');
      if (messages.length === 0) {
        logger.warn(`Could not find messages for ${profile.profile_url}`);
        continue;
      }
      
      const lastMessageText = await messages[messages.length - 1].innerText();
      logger.info(`Last message from ${profile.name || profile.profile_url}: "${lastMessageText.substring(0, 50)}..."`);

      if (profile.state === 'sending_reply' && profile.pendingAiResponse) {
         if (lastMessageText.includes(profile.pendingAiResponse.substring(0, 20))) {
             logger.info(`Detected already sent reply for ${profile.profile_url}. Recovering state.`);
             connectionRepo.upsert(profile.profile_url, 'conversation_active', {
                aiResponseSent: true,
                lastAiResponse: profile.pendingAiResponse,
                lastAiResponseAt: new Date().toISOString(),
                pendingAiResponse: null
             });
             continue;
         }
      }

      const aiResponse = await generateReplyResponse(profile, lastMessageText);

      if (aiResponse.includes('ESC_HUMAN')) {
        logger.info(`Escalating ${profile.profile_url} to human review.`);
        connectionRepo.upsert(profile.profile_url, 'interested', {
          aiResponseSent: true,
          escalatedAt: new Date().toISOString()
        });
        await appendReviewQueue({
          type: 'human_escalation',
          profile: profile.profile_url,
          reason: 'AI requested human escalation for message: ' + lastMessageText.substring(0, 100)
        });
        await sendAlert(`🔥 *Hot Lead*! AI escalated ${profile.name || profile.profile_url} to human review: "${lastMessageText.substring(0, 50)}..."`);
        responsesSent++; // Counting escalation as a processed record
      } else {
        const editor = await page.$('.msg-form__contenteditable[role="textbox"]');
        if (editor) {
          connectionRepo.upsert(profile.profile_url, 'sending_reply', {
              pendingAiResponse: aiResponse,
              aiResponseDraftedAt: new Date().toISOString()
          });

          await humanClick(editor, signal);
          await humanType(editor, aiResponse, signal);
          await randomDelay(2000, 4000, signal);
          
          const sendButton = await page.$('.msg-form__send-button');
          if (sendButton && !(await sendButton.isDisabled())) {
            await humanClick(sendButton, signal);
            
            connectionRepo.upsert(profile.profile_url, 'conversation_active', {
              aiResponseSent: true,
              lastAiResponse: aiResponse,
              lastAiResponseAt: new Date().toISOString(),
              pendingAiResponse: null
            });
            logger.info(`Successfully sent AI response to ${profile.name || profile.profile_url}`);
            responsesSent++;
          } else {
            logger.warn(`Could not find enabled send button for ${profile.profile_url}`);
          }
        } else {
          logger.warn(`Could not find message editor for ${profile.profile_url}`);
        }
      }
    } catch (error) {
      if (error instanceof EmergencyStopError || error.message.includes('EmergencyStopError') || error.message.includes('aborted')) {
        logger.info('Reply response workflow aborted gracefully due to emergency stop or timeout.');
        return { recordsProcessed: responsesSent };
      }
      logger.error(`Failed to process response for ${profile.profile_url}`, { error: error.message });
    }
    await randomDelay(5000, 10000, signal);
  }
  return { recordsProcessed: responsesSent };
}
