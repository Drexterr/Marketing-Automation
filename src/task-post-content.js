import logger from './utils/logger.js';
import { randomDelay, isSessionValid, updateSystemState, getSystemState } from './utils/helpers.js';
import { generateLinkedInPost } from './claude-service.js';

export async function runPostContent(page) {
  const state = await getSystemState();
  if (process.env.ENABLE_AUTO_POST !== 'true') {
    logger.info('Auto-post is disabled (ENABLE_AUTO_POST != true). Skipping.');
    return { recordsProcessed: 0 };
  }

  // Only post 2x per week (Tue and Thu)
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 2 = Tuesday, 4 = Thursday
  if (day !== 2 && day !== 4) {
    logger.info('Not a scheduled posting day (Tuesday or Thursday). skipping.');
    return { recordsProcessed: 0 };
  }

  // Check if we already posted today
  const lastPostDate = state.lastPostDate ? new Date(state.lastPostDate) : null;
  if (lastPostDate && lastPostDate.toDateString() === now.toDateString()) {
    logger.info('Already posted content today. Skipping.');
    return { recordsProcessed: 0 };
  }

  if (!(await isSessionValid(page))) {
    throw new Error('Session invalid. Cannot post content.');
  }

  logger.info('Generating LinkedIn post content...');
  const topic = "interview anxiety and how AI practice tools help";
  const postContent = await generateLinkedInPost(topic);

  logger.info(`Drafted post: "${postContent.substring(0, 100)}..."`);
  let posted = false;

  try {
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle' });
    await randomDelay(5000, 8000);

    const startPostButton = await page.$('.share-box-feed-entry__trigger');
    if (startPostButton) {
      await startPostButton.click();
      await randomDelay(2000, 4000);

      const editor = await page.$('.ql-editor[role="textbox"]');
      if (editor) {
        await editor.type(postContent, { delay: 50 });
        await randomDelay(3000, 5000);

        const postButton = await page.$('.share-actions__primary-action');
        if (postButton) {
          await postButton.click();
          await randomDelay(5000, 10000);
          
          await updateSystemState({ lastPostDate: now.toISOString() });
          logger.info('Successfully posted LinkedIn content.');
          posted = true;
        }
      }
    }
  } catch (error) {
    logger.error('Failed to post LinkedIn content', { error: error.message });
  }
  return { recordsProcessed: posted ? 1 : 0 };
}
