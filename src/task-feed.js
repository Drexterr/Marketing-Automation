import { BrowserManager } from './browser.js';
import * as claudeService from './claude-service.js';
import { randomDelay, appendAction, loadFeedData, humanType, humanClick, humanScroll, isWithinOperatingHours, isSessionValid, EmergencyStopError } from './utils/helpers.js';
import logger from './utils/logger.js';
import { RuntimeStateService } from '../backend-api/services/RuntimeStateService.js';
import path from 'path';

const COMMENTS_FILE = path.join(process.cwd(), 'data', 'comments-sent.json');

export async function runFeedCommenting(count = 3) {
  const browserManager = new BrowserManager();
  const page = await browserManager.launch(process.env.HEADLESS === 'true');

  /**
   * Fix 2: Remove duplicate file reads in feed startup
   * Only ONE file read at startup
   */
  if (!isWithinOperatingHours()) {
    logger.warn('Outside operating hours (9am–8pm). Skipping feed run.');
    await browserManager.close();
    return;
  }

  const feedData = loadFeedData(COMMENTS_FILE);
  const seenUrns = new Set(feedData.map(e => e.urn).filter(Boolean));
  const relevanceCache = new Map(
    feedData.map(e => [e.urn, e.relevant])
  );

  try {
    logger.info('Navigating to LinkedIn feed');
    await page.goto('https://www.linkedin.com/feed/');
    await page.waitForSelector('.scaffold-layout__main', { timeout: 30000 });

    let commentsSent = 0;
    let scrollAttempts = 0;
    const MAX_SCROLL_ATTEMPTS = 20;

    while (commentsSent < count && scrollAttempts < MAX_SCROLL_ATTEMPTS) {
      if (RuntimeStateService.shouldStop('feed')) {
        logger.info('Feed task interrupted by system signal');
        return;
      }

      const posts = await page.$$('.feed-shared-update-v2');
      let newPostsFound = false;

      for (const post of posts) {
        if (RuntimeStateService.shouldStop('feed')) {
          logger.info('Feed task interrupted by system signal');
          return;
        }

        // Mid-loop safety check
        if (!(await isSessionValid(page))) {
          throw new Error('Session restricted or expired mid-loop during feed processing');
        }

        if (commentsSent >= count) break;

        const urn = await post.getAttribute('data-urn');
        if (!urn || seenUrns.has(urn)) continue;
        
        newPostsFound = true;
        seenUrns.add(urn);

        const isPromoted = await post.$('.feed-shared-update-v2__sub-line--promoted');
        if (isPromoted) continue;

        const textElement = await post.$('.feed-shared-update-v2__description-wrapper');
        if (!textElement) continue;

        const postText = await textElement.innerText();
        if (postText.length < 50) continue;

        logger.info(`Found candidate post: ${urn}`);

        try {
          await post.scrollIntoViewIfNeeded();

          let relevant;
          if (relevanceCache.has(urn)) {
            relevant = relevanceCache.get(urn);
          } else {
            relevant = await claudeService.isPostRelevant(postText);
            relevanceCache.set(urn, relevant);
            if (!relevant) {
              await appendAction(COMMENTS_FILE, { urn, postText: postText.substring(0, 100), relevant: false, status: 'skipped-irrelevant' });
            }
          }

          if (!relevant) continue;

          logger.info('Generating comment with Claude...');
          const comment = await claudeService.generateFeedComment(postText);
          
          const commentButton = await post.$('button:has-text("Comment")');
          if (!commentButton) continue;
          
          await humanClick(commentButton);
          await randomDelay(1000, 2000);

          const editor = await post.$('.ql-editor[role="textbox"]');
          if (!editor) continue;

          await humanType(editor, comment);
          await randomDelay(1000, 3000);

          const postButton = await post.$('button.comments-comment-box__submit-button');
          if (postButton) {
            await humanClick(postButton);
            logger.info('Successfully posted comment');

            await appendAction(COMMENTS_FILE, {
              urn,
              postText: postText.substring(0, 100),
              comment,
              relevant: true,
              status: 'sent',
            });
            commentsSent++;
            await randomDelay(60000, 120000);
          }
        } catch (err) {
          if (err instanceof EmergencyStopError || err.message.includes('EmergencyStopError')) {
            logger.info('Feed task aborted gracefully due to emergency stop.');
            return;
          }
          logger.error(`Failed to comment on post ${urn}`, { message: err.message });
        }
      }

      if (!newPostsFound) scrollAttempts++;
      else scrollAttempts = 0;

      if (commentsSent < count && scrollAttempts < MAX_SCROLL_ATTEMPTS) {
        logger.info(`Progress: ${commentsSent}/${count}. Scrolling for more posts...`);
        await humanScroll(page);
      }
    }

    if (scrollAttempts >= MAX_SCROLL_ATTEMPTS) {
      logger.warn('Feed exhausted — exiting early');
    }

    return { recordsProcessed: commentsSent };

  } catch (error) {
    if (error instanceof EmergencyStopError || error.message.includes('EmergencyStopError')) {
      logger.info('Feed commenting workflow aborted gracefully due to emergency stop.');
    } else {
      logger.error('Feed commenting workflow failed', { message: error.message });
    }
    return { recordsProcessed: commentsSent || 0 };
  } finally {
    await browserManager.close();
  }
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1].endsWith('task-feed.js')) {
    runFeedCommenting(1).catch(console.error);
}
