import { BrowserManager } from './browser.js';
import * as claudeService from './claude-service.js';
import { randomDelay, appendAction, loadFeedData, humanType, humanClick, humanScroll, isWithinOperatingHours, isSessionValid, EmergencyStopError } from './utils/helpers.js';
import { visionFindEditor, visionClick } from './utils/vision.js';
import logger from './utils/logger.js';
import { RuntimeStateService } from '../backend-api/services/RuntimeStateService.js';
import { ActivityRepository } from '../shared/repositories/ActivityRepository.js';
import path from 'path';

const activityRepo = new ActivityRepository();

const COMMENTS_FILE = path.join(process.cwd(), 'data', 'comments-sent.json');

export async function runFeedCommenting(count = 3, signal = null) {
  const browserManager = new BrowserManager();
  const page = await browserManager.launch(process.env.HEADLESS === 'true');

  /**
   * Fix 2: Remove duplicate file reads in feed startup
   * Only ONE file read at startup
   */
  if (!isWithinOperatingHours()) {
    logger.warn('Outside operating hours (9am–8pm). Skipping feed run.');
    await browserManager.close();
    return { recordsProcessed: 0 };
  }

  const feedData = loadFeedData(COMMENTS_FILE);

  // Build the set of already-commented post keys from two sources:
  // 1. SQLite activity log (primary — survives across sessions)
  // 2. JSON file (backward compat)
  const seenPostKeys = new Set();
  try {
    const rows = activityRepo.db.prepare(
      `SELECT details FROM activity_log WHERE event_type = 'feed_comment'`
    ).all();
    for (const row of rows) {
      try {
        const d = JSON.parse(row.details || '{}');
        if (d.postText) seenPostKeys.add(d.postText);
      } catch {}
    }
  } catch (e) {
    logger.warn('Could not query activity log for seen posts', { message: e.message });
  }
  for (const entry of feedData) {
    if (entry.postText) seenPostKeys.add(entry.postText);
    if (entry.urn) seenPostKeys.add(entry.urn); // legacy field
  }

  const relevanceCache = new Map(
    feedData.map(e => [e.postText ?? e.urn, e.relevant]).filter(([k]) => k)
  );

  if (!(await isSessionValid(page))) {
    await browserManager.close();
    throw new Error('Session invalid at feed startup — aborting.');
  }

  let commentsSent = 0;
  try {
    logger.info('Navigating to LinkedIn feed');
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle', timeout: 45000 });

    const finalUrl = page.url();
    if (!finalUrl.includes('linkedin.com/feed')) {
      throw new Error(`Feed navigation landed on unexpected URL: ${finalUrl}`);
    }
    logger.info('Feed page confirmed by URL — proceeding');

    let scrollAttempts = 0;
    const MAX_SCROLL_ATTEMPTS = 20;

    while (commentsSent < count && scrollAttempts < MAX_SCROLL_ATTEMPTS) {
      if (RuntimeStateService.shouldStop('feed') || signal?.aborted) {
        logger.info('Feed task interrupted by system signal');
        return { recordsProcessed: commentsSent };
      }

      if (!(await isSessionValid(page))) {
        throw new Error('Session restricted or expired mid-loop during feed processing');
      }

      // Find Comment buttons visible in the current viewport — each one belongs to a post.
      // This approach is selector-free: regardless of what LinkedIn names its post containers,
      // each post always has a "Comment" button we can anchor to.
      const commentBtns = await page.getByRole('button', { name: /^comment$/i }).all();
      logger.info(`Found ${commentBtns.length} Comment button(s) in viewport`);

      let newPostsFound = false;

      for (const commentBtn of commentBtns) {
        if (RuntimeStateService.shouldStop('feed') || signal?.aborted) {
          logger.info('Feed task interrupted by system signal');
          return { recordsProcessed: commentsSent };
        }
        if (commentsSent >= count) break;

        // Extract post text and URN by walking up from the Comment button.
        // URN is preferred as the dedup key — it's stable even after comments are added,
        // whereas post text grows to include new comments and would produce a different key.
        const { postText, postUrn } = await commentBtn.evaluate(btn => {
          let el = btn.parentElement;
          let urn = null;
          while (el && el !== document.body) {
            if (!urn) {
              const attr = el.getAttribute('data-urn') || el.getAttribute('data-activity-urn') || el.getAttribute('data-id');
              if (attr && attr.includes('activity')) urn = attr;
            }
            const text = (el.innerText || '').trim();
            if (text.length > 150) return { postText: text.slice(0, 800), postUrn: urn };
            el = el.parentElement;
          }
          return { postText: '', postUrn: urn };
        }).catch(() => ({ postText: '', postUrn: null }));

        if (postText.length < 50) continue;

        const postKey = postUrn || postText.slice(0, 80);

        // Layer 1: cross-session dedup via SQLite + JSON file
        if (seenPostKeys.has(postKey)) {
          logger.info(`Already commented on this post in a previous session — skipping`);
          continue;
        }

        newPostsFound = true;
        seenPostKeys.add(postKey);

        // Check if post is relevant to target topics
        let relevant;
        if (relevanceCache.has(postKey)) {
          relevant = relevanceCache.get(postKey);
        } else {
          relevant = await claudeService.isPostRelevant(postText);
          relevanceCache.set(postKey, relevant);
        }

        if (!relevant) {
          logger.info(`Skipping irrelevant post: "${postKey.replace(/\n/g, ' ')}"`);
          await appendAction(COMMENTS_FILE, { postText: postKey, relevant: false, status: 'skipped-irrelevant' });
          continue;
        }

        logger.info(`Relevant post — checking comment section for our name before commenting`);

        try {
          await commentBtn.scrollIntoViewIfNeeded();
          await randomDelay(800, 1500, signal);

          // Click the Comment button — this opens the editor AND loads the comment section.
          await commentBtn.click();
          await randomDelay(1500, 3000, signal);

          // Layer 2: live comment-section check. Now that comments are loaded in the DOM,
          // scan for our name. This catches old posts that were commented on outside this
          // session and wouldn't be in seenPostKeys.
          const founderName = process.env.FOUNDER_NAME || '';
          if (founderName) {
            const alreadyCommented = await page.evaluate((name) => {
              const commentEls = document.querySelectorAll(
                '.comments-comment-item, [class*="comment-item"], [data-id*="comment"]'
              );
              return Array.from(commentEls).some(c => (c.innerText || '').includes(name));
            }, founderName).catch(() => false);

            if (alreadyCommented) {
              logger.info(`Our comment found in loaded comment section — skipping`);
              await page.keyboard.press('Escape').catch(() => {});
              await appendAction(COMMENTS_FILE, { postText: postKey, relevant: true, status: 'already-commented' });
              continue;
            }
          }

          logger.info(`No existing comment found — generating comment with Claude...`);
          const comment = await claudeService.generateFeedComment(postText);

          const editor = await visionFindEditor(page, 6000);
          if (!editor) {
            logger.warn('Comment editor did not appear — skipping post');
            continue;
          }

          await humanType(editor, comment, signal);
          await randomDelay(1000, 2000, signal);

          // Find the submit button — walk from the editor outward to its form/container,
          // then look for any enabled button that isn't Cancel/Discard/Close.
          let submitted = false;

          // Try stable selectors first
          for (const sel of [
            'button[aria-label*="Post comment" i]',
            'button[aria-label*="Submit" i]',
            'button[data-control-name="comment.submit"]',
            '.comments-comment-box__submit-button:not([disabled])',
            'button.comments-comment-texteditor__submitbutton:not([disabled])',
          ]) {
            const btn = await page.$(sel);
            if (btn && await btn.isVisible().catch(() => false)) {
              await humanClick(btn, signal);
              submitted = true;
              break;
            }
          }

          // DOM crawl: find enabled buttons near the editor
          if (!submitted) {
            const submitHandle = await page.evaluateHandle(() => {
              const editor = document.querySelector('[role="textbox"][contenteditable="true"], .ql-editor');
              if (!editor) return null;
              let container = editor.parentElement;
              for (let i = 0; i < 8; i++) {
                if (!container) break;
                const btns = Array.from(container.querySelectorAll('button:not([disabled])'));
                const postBtn = btns.find(b => {
                  const t = (b.innerText || b.textContent || b.getAttribute('aria-label') || '').toLowerCase().trim();
                  return t === 'post' || t === 'submit' || t === 'post comment' || t === 'comment';
                });
                if (postBtn) return postBtn;
                container = container.parentElement;
              }
              return null;
            });
            const submitEl = submitHandle.asElement();
            if (submitEl) {
              await submitEl.click();
              submitted = true;
            }
          }

          // Last resort: Ctrl+Enter submits the LinkedIn comment box
          if (!submitted) {
            logger.info('Submit button not found — trying Ctrl+Enter');
            await page.keyboard.press('Control+Enter');
            submitted = true;
          }

          if (submitted) {
            logger.info('Comment posted successfully');
            await appendAction(COMMENTS_FILE, { postText: postKey, comment, relevant: true, status: 'sent' });
            activityRepo.log('feed_comment', 'feed', { postText: postKey, comment, status: 'success' });
            seenPostKeys.add(postKey); // guard against same post appearing again this session
            commentsSent++;
            await randomDelay(60000, 120000, signal);
          } else {
            logger.warn('Could not find submit button — comment not posted');
            // Press Escape to close the comment box
            await page.keyboard.press('Escape');
          }
        } catch (err) {
          if (err instanceof EmergencyStopError || err.message.includes('EmergencyStopError') || err.message.includes('aborted')) {
            logger.info('Feed task aborted gracefully');
            return { recordsProcessed: commentsSent };
          }
          logger.error('Failed to comment on post', { message: err.message });
          await page.keyboard.press('Escape').catch(() => {});
        }
      }

      if (!newPostsFound) scrollAttempts++;
      else scrollAttempts = 0;

      if (commentsSent < count && scrollAttempts < MAX_SCROLL_ATTEMPTS) {
        logger.info(`Progress: ${commentsSent}/${count}. Scrolling for more posts...`);
        await humanScroll(page, signal);
      }
    }

    if (scrollAttempts >= MAX_SCROLL_ATTEMPTS) {
      logger.warn('Feed exhausted — no more new posts found');
    }

    return { recordsProcessed: commentsSent };

  } catch (error) {
    if (error instanceof EmergencyStopError || error.message.includes('EmergencyStopError') || error.message.includes('aborted')) {
      logger.info('Feed commenting workflow aborted gracefully due to emergency stop or timeout.');
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
