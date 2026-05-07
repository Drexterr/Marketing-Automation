import logger from './utils/logger.js';
import { randomDelay, randomBetween, appendConnection, checkWeeklyLimit, getDynamicWeeklyLimit, checkDailyLimit, isSessionValid } from './utils/helpers.js';
import * as claudeService from './claude-service.js';
import path from 'path';

const CONNECTIONS_SENT_FILE = path.join(process.cwd(), 'data', 'connections-sent.json');

export async function searchAndExtractProfiles(page, keyword) {
  logger.info(`Searching for: ${keyword}`);
  const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keyword)}&origin=CLUSTER_EXPANSION`;
  
  try {
    await page.goto(searchUrl, { waitUntil: 'networkidle' });
    await page.waitForSelector('.reusable-search__result-container', { timeout: 15000 });

    await page.evaluate(async () => {
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(resolve => setTimeout(resolve, 2000));
    });

    const profiles = await page.evaluate(() => {
      const results = [];
      const containers = document.querySelectorAll('.reusable-search__result-container');
      
      containers.forEach(container => {
        const nameElement = container.querySelector('.entity-result__title-text a span[aria-hidden="true"]');
        const headlineElement = container.querySelector('.entity-result__primary-subtitle');
        const companyElement = container.querySelector('.entity-result__secondary-subtitle');
        const linkElement = container.querySelector('.entity-result__title-text a');

        if (nameElement && headlineElement && linkElement) {
          results.push({
            name: nameElement.innerText.trim(),
            headline: headlineElement.innerText.trim(),
            company: companyElement ? companyElement.innerText.trim() : '',
            url: linkElement.href.split('?')[0]
          });
        }
      });
      return results;
    });

    logger.info(`Found ${profiles.length} profiles for keyword: ${keyword}`);
    return profiles;
  } catch (error) {
    logger.error(`Error during search for ${keyword}`, { error: error.message });
    return [];
  }
}

export async function runConnectionWorkflow(page) {
  if (!(await isSessionValid(page))) {
    throw new Error('Session expired or restricted. Aborting run.');
  }

  const keywords = (process.env.TARGET_KEYWORDS || '').split(',').map(k => k.trim());
  const weeklyLimit = getDynamicWeeklyLimit();
  const dailyMax = randomBetween(8, 12); // Daily max connections 8-12

  logger.info(`Starting run: Weekly Limit = ${weeklyLimit}, Daily Max = ${dailyMax}`);

  for (const keyword of keywords) {
    if (!checkWeeklyLimit(CONNECTIONS_SENT_FILE, weeklyLimit)) {
      logger.warn('Dynamic weekly connection limit reached. Stopping.');
      break;
    }

    if (!checkDailyLimit(CONNECTIONS_SENT_FILE, dailyMax)) {
      logger.warn(`Daily connection limit (${dailyMax}) reached. Spreading actions. Stopping for today.`);
      break;
    }

    const profiles = await searchAndExtractProfiles(page, keyword);

    for (const profile of profiles) {
      if (!checkWeeklyLimit(CONNECTIONS_SENT_FILE, weeklyLimit) || !checkDailyLimit(CONNECTIONS_SENT_FILE, dailyMax)) {
        logger.warn('Limits reached during processing. Stopping.');
        return;
      }

      logger.info(`Evaluating profile: ${profile.name}`);
      
      try {
        const evaluation = await claudeService.evaluateConnectionTarget(profile.name, profile.headline, profile.company);
        logger.info(`Score: ${evaluation.score} - ${evaluation.reason}`);

        if (evaluation.score >= 7) {
          const note = await claudeService.generateConnectionNote(
            profile.name,
            profile.headline,
            profile.company
          );
          
          const sent = await sendConnectionRequest(page, profile, evaluation.score, note);
          if (sent) await randomDelay(); // Uses new Phase 3 defaults (8-25s)
        } else {
          logger.info(`Skipping ${profile.name} (low score)`);
          await randomDelay(3000, 7000);
        }
      } catch (error) {
        logger.error(`Error processing profile ${profile.name}`, { error: error.message });
      }
    }

    logger.info(`Finished keyword "${keyword}". Waiting before next search...`);
    await randomDelay(10000, 20000);
  }
}

async function sendConnectionRequest(page, profile, score, note) {
  logger.info(`Sending connection request to ${profile.name}`);
  let success = false;
  let failureReason = null;

  try {
    await page.goto(profile.url, { waitUntil: 'networkidle' });
    await randomDelay(5000, 8000);

    let connectButton = await page.$('button.pvs-profile-actions__action:has-text("Connect")');

    if (!connectButton) {
      const moreButton = await page.$('button[aria-label="More actions"]');
      if (moreButton) {
        await moreButton.click();
        await randomDelay(1000, 2000);
        connectButton = await page.$('div[role="button"]:has-text("Connect")');
      }
    }

    if (!connectButton) {
      logger.warn(`Connect button not found for ${profile.name}`);
      failureReason = 'connect_button_not_found';
    } else {
      await connectButton.click();
      await randomDelay(2000, 4000);

      const addNoteButton = await page.$('button[aria-label="Add a note"]');
      if (!addNoteButton) {
        logger.warn(`"Add a note" button not found for ${profile.name}`);
        failureReason = 'note_dialog_missing';
        const cancelButton = await page.$('button[aria-label="Dismiss"]');
        if (cancelButton) await cancelButton.click();
      } else {
        await addNoteButton.click();
        await randomDelay(2000, 3000);

        const editor = await page.$('textarea[name="message"]');
        if (editor) {
          await editor.type(note, { delay: 50 });
          await randomDelay(2000, 4000);
          await page.click('button[aria-label="Send now"]');
          success = true;
          logger.info(`Successfully sent request to ${profile.name}`);
        } else {
          failureReason = 'note_editor_not_found';
        }
      }
    }
  } catch (error) {
    logger.error(`Failed to send connection request to ${profile.name}`, { error: error.message });
    failureReason = `error: ${error.message}`;
  }

  /**
   * Fix 4: Log ALL outcomes (success or failure)
   */
  await appendConnection(CONNECTIONS_SENT_FILE, {
    name: profile.name,
    headline: profile.headline,
    url: profile.url,
    score,
    note,
    status: success ? 'pending' : 'failed',
    stage: success ? 'connected' : null,
    failureReason: success ? null : failureReason
  });

  return success;
}
