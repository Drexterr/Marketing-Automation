import logger from './utils/logger.js';
import { randomDelay, isSessionValid, updateSystemState, getSystemState, humanType, humanClick, EmergencyStopError } from './utils/helpers.js';
import { visionClick, visionFindEditor } from './utils/vision.js';
import { generateLinkedInPost } from './claude-service.js';

export async function runPostContent(page, signal = null) {
  const state = await getSystemState();
  if (process.env.ENABLE_AUTO_POST !== 'true') {
    logger.info('Auto-post is disabled (ENABLE_AUTO_POST != true). Skipping.');
    return { recordsProcessed: 0 };
  }

  const now = new Date();
  const day = now.getDay(); // 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
  const frequency = process.env.POST_FREQUENCY || 'biweekly';
  // daily = every day, weekly = Monday only, biweekly = Tuesday + Thursday
  const postToday = frequency === 'daily'
    || (frequency === 'weekly' && day === 1)
    || (frequency === 'biweekly' && (day === 2 || day === 4));
  if (!postToday) {
    logger.info(`Not a scheduled posting day for frequency "${frequency}". Skipping.`);
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
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle', timeout: 45000 });
    await randomDelay(3000, 6000, signal);

    // Click "Start a post" — try aria-label, then vision
    let startClicked = false;
    const startBtn = await page.$('[aria-label*="Start a post" i], [placeholder*="Start a post" i]');
    if (startBtn) {
      await humanClick(startBtn, signal);
      startClicked = true;
    } else {
      startClicked = await visionClick(page, '"Start a post" text box or button at the top of the LinkedIn feed');
    }

    if (startClicked) {
      await randomDelay(2000, 4000, signal);

      const editor = await visionFindEditor(page, 8000);
      if (editor) {
        await humanType(editor, postContent, signal);
        await randomDelay(3000, 5000, signal);

        // "Post" submit button — try aria-label, then vision
        let submitted = false;
        const postBtn = await page.$('button[aria-label*="Post" i]:not([disabled]), .share-actions__primary-action');
        if (postBtn) {
          await humanClick(postBtn, signal);
          submitted = true;
        } else {
          submitted = await visionClick(page, 'the blue "Post" submit button to publish the LinkedIn post');
        }

        if (submitted) {
          await randomDelay(5000, 10000, signal);
          await updateSystemState({ lastPostDate: now.toISOString() });
          logger.info('Successfully posted LinkedIn content.');
          posted = true;
        }
      }
    }
  } catch (error) {
    if (error instanceof EmergencyStopError || error.message.includes('EmergencyStopError') || error.message.includes('aborted')) {
      logger.info('Post content workflow aborted gracefully due to emergency stop or timeout.');
    } else {
      logger.error('Failed to post LinkedIn content', { error: error.message });
    }
  }
  return { recordsProcessed: posted ? 1 : 0 };
}
