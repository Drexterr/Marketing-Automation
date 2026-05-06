import { BrowserManager } from './browser.js';
import * as claudeService from './claude-service.js';
import { randomDelay, logAction } from './utils/helpers.js';
import logger from './utils/logger.js';
import path from 'path';

export async function runFeedCommenting(count = 3) {
  const browserManager = new BrowserManager();
  const page = await browserManager.launch(false); // Non-headless for initial verification

  try {
    logger.info('Navigating to LinkedIn feed');
    await page.goto('https://www.linkedin.com/feed/');
    await page.waitForSelector('.scaffold-layout__main', { timeout: 30000 });

    let commentsSent = 0;
    const processedPostUrns = new Set();

    while (commentsSent < count) {
      const posts = await page.$$('.feed-shared-update-v2');
      
      for (const post of posts) {
        if (commentsSent >= count) break;

        const urn = await post.getAttribute('data-urn');
        if (!urn || processedPostUrns.has(urn)) continue;
        processedPostUrns.add(urn);

        // Check if promoted
        const isPromoted = await post.$('.feed-shared-update-v2__sub-line--promoted');
        if (isPromoted) continue;

        // Extract text
        const textElement = await post.$('.feed-shared-update-v2__description-wrapper');
        if (!textElement) continue;
        
        const postText = await textElement.innerText();
        if (postText.length < 50) continue;

        logger.info(`Found candidate post: ${urn}`);
        
        try {
          await post.scrollIntoViewIfNeeded();
          
          logger.info('Generating comment with Claude...');
          const comment = await claudeService.generateFeedComment(postText);
          logger.info(`Generated comment: ${comment}`);

          const commentButton = await post.$('button:has-text("Comment")');
          if (!commentButton) {
            logger.warn(`Comment button not found for post ${urn}`);
            continue;
          }
          await commentButton.click();
          await randomDelay(1000, 2000);

          const editor = await post.$('.ql-editor[role="textbox"]');
          if (!editor) {
            logger.warn(`Comment textbox not found for post ${urn}`);
            continue;
          }
          await editor.fill(comment);
          await randomDelay(1000, 3000);

          const postButton = await post.$('button.comments-comment-box__submit-button');
          if (postButton) {
            await postButton.click();
            logger.info('Successfully posted comment');
            
            await logAction(path.join(process.cwd(), 'data', 'comments-sent.json'), {
              urn,
              postText: postText.substring(0, 100),
              comment,
              status: 'sent'
            });
            commentsSent++;
            await randomDelay(5000, 10000);
          }
        } catch (err) {
          logger.error(`Failed to comment on post ${urn}`, { message: err.message });
        }
      }

      logger.info(`Progress: ${commentsSent}/${count}`);
      await page.evaluate(() => window.scrollBy(0, 500));
      await randomDelay(2000, 4000);
    }

  } catch (error) {
    logger.error('Feed commenting workflow failed', { message: error.message });
  } finally {
    await browserManager.close();
  }
}

// Simple CLI runner if called directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1].endsWith('task-feed.js')) {
    runFeedCommenting(1).catch(console.error);
}
