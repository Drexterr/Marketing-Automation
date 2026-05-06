import { BrowserManager } from './browser.js';
import * as claudeService from './claude-service.js';
import { randomDelay, appendAction, loadFeedData } from './utils/helpers.js';
import logger from './utils/logger.js';
import path from 'path';

const COMMENTS_FILE = path.join(process.cwd(), 'data', 'comments-sent.json');

function loadSeenUrns() {
  const data = loadFeedData(COMMENTS_FILE);
  return new Set(data.map(e => e.urn).filter(Boolean));
}

function loadRelevanceCache() {
  const data = loadFeedData(COMMENTS_FILE);
  const cache = {};
  for (const entry of data) {
    if (entry.urn && entry.relevant !== undefined) {
      cache[entry.urn] = entry.relevant;
    }
  }
  return cache;
}

export async function runFeedCommenting(count = 3) {
  const browserManager = new BrowserManager();
  /**
   * Fix 6: Respect HEADLESS env
   */
  const page = await browserManager.launch(process.env.HEADLESS === 'true');

  const seenUrns = loadSeenUrns();
  const relevanceCache = loadRelevanceCache();

  try {
    logger.info('Navigating to LinkedIn feed');
    await page.goto('https://www.linkedin.com/feed/');
    await page.waitForSelector('.scaffold-layout__main', { timeout: 30000 });

    let commentsSent = 0;
    /**
     * Fix 5: Add max-scroll guard
     */
    let scrollAttempts = 0;
    const MAX_SCROLL_ATTEMPTS = 20;

    while (commentsSent < count && scrollAttempts < MAX_SCROLL_ATTEMPTS) {
      const posts = await page.$$('.feed-shared-update-v2');
      let newPostsFound = false;

      for (const post of posts) {
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
          if (relevanceCache[urn] !== undefined) {
            relevant = relevanceCache[urn];
          } else {
            relevant = await claudeService.isPostRelevant(postText);
            relevanceCache[urn] = relevant;
            if (!relevant) {
              await appendAction(COMMENTS_FILE, { urn, postText: postText.substring(0, 100), relevant: false, status: 'skipped-irrelevant' });
            }
          }

          if (!relevant) continue;

          logger.info('Generating comment with Claude...');
          const comment = await claudeService.generateFeedComment(postText);
          
          const commentButton = await post.$('button:has-text("Comment")');
          if (!commentButton) continue;
          
          await commentButton.click();
          await randomDelay(1000, 2000);

          const editor = await post.$('.ql-editor[role="textbox"]');
          if (!editor) continue;

          /**
           * Fix 7: Fix typing focus drift
           */
          await editor.type(comment, { delay: 50 });
          await randomDelay(1000, 3000);

          const postButton = await post.$('button.comments-comment-box__submit-button');
          if (postButton) {
            await postButton.click();
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
          logger.error(`Failed to comment on post ${urn}`, { message: err.message });
        }
      }

      if (!newPostsFound) scrollAttempts++;
      else scrollAttempts = 0;

      if (commentsSent < count && scrollAttempts < MAX_SCROLL_ATTEMPTS) {
        logger.info(`Progress: ${commentsSent}/${count}. Scrolling for more posts...`);
        await page.evaluate(() => window.scrollBy(0, 800));
        await randomDelay(2000, 4000);
      }
    }

    if (scrollAttempts >= MAX_SCROLL_ATTEMPTS) {
      logger.warn('Feed exhausted — exiting early');
    }

  } catch (error) {
    logger.error('Feed commenting workflow failed', { message: error.message });
  } finally {
    await browserManager.close();
  }
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1].endsWith('task-feed.js')) {
    runFeedCommenting(1).catch(console.error);
}
