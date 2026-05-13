import logger from './utils/logger.js';
import { randomDelay, randomBetween, checkWeeklyLimit, getDynamicWeeklyLimit, checkDailyLimit, isSessionValid, logSessionSummary, humanType, humanClick, isWithinOperatingHours, EmergencyStopError } from './utils/helpers.js';
import * as claudeService from './claude-service.js';
import { RuntimeStateService } from '../backend-api/services/RuntimeStateService.js';
import { ConnectionRepository } from '../shared/repositories/ConnectionRepository.js';

const connectionRepo = new ConnectionRepository();

export async function searchAndExtractProfiles(page, keyword) {
  logger.info(`Searching for: ${keyword}`);
  const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keyword)}&origin=CLUSTER_EXPANSION`;
  
  try {
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
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

async function scrapeProfileDetails(page, profile, signal = null) {
  logger.info(`Deep scraping profile: ${profile.name}`);
  try {
    await page.goto(profile.url, { waitUntil: 'domcontentloaded' });
    await randomDelay(5000, 10000, signal);

    const details = await page.evaluate(() => {
      const about = document.querySelector('#about ~ .pvs-list span[aria-hidden=true]')?.innerText || '';
      // Open to work badge often has a specific class or alt text in the profile photo area
      const isOpenToWork = !!document.querySelector('img[alt*="Open to Work"]'); 
      return { about, isOpenToWork };
    });

    profile.about = details.about;
    profile.isOpenToWork = details.isOpenToWork;
    logger.info(`Scraped details for ${profile.name}: OpenToWork=${profile.isOpenToWork}`);
  } catch (error) {
    if (error instanceof EmergencyStopError || error.message.includes('EmergencyStopError') || error.message.includes('aborted')) {
      throw error;
    }
    logger.warn(`Failed to deep scrape ${profile.name}`, { message: error.message });
  }
}

function evaluationScoreHeuristic(headline) {
  const techKeywords = ['engineer', 'developer', 'software', 'tech', 'coding', 'student', 'cs', 'computer science'];
  const lowerHeadline = headline.toLowerCase();
  return techKeywords.some(kw => lowerHeadline.includes(kw));
}

export async function runConnectionWorkflow(page, signal = null) {
  if (!isWithinOperatingHours()) {
    logger.warn('Outside operating hours (9am–8pm). Skipping run.');
    return { recordsProcessed: 0 };
  }

  if (!(await isSessionValid(page))) {
    throw new Error('Session expired or restricted. Aborting run.');
  }

  const keywords = (process.env.TARGET_KEYWORDS || '').split(',').map(k => k.trim());
  const weeklyLimit = await getDynamicWeeklyLimit();
  const dailyCap = 8; // Required hard cap from audit

  let connectionsSent = 0;
  let failed = 0;
  let dailyLimitHit = false;

  logger.info(`Starting run: Weekly Limit = ${weeklyLimit}, Daily Cap = ${dailyCap}`);

  for (const keyword of keywords) {
    if (RuntimeStateService.shouldStop('connect') || signal?.aborted) {
      logger.info('Connect task interrupted by system signal');
      return { recordsProcessed: connectionsSent };
    }

    if (!checkWeeklyLimit('connections', weeklyLimit)) {
      logger.warn('Dynamic weekly connection limit reached. Stopping.');
      break;
    }

    if (!(await checkDailyLimit('connections', dailyCap))) {
      logger.info('Daily connection cap reached — stopping session');
      dailyLimitHit = true;
      break;
    }

    const profiles = await searchAndExtractProfiles(page, keyword);

    for (const profile of profiles) {
      if (RuntimeStateService.shouldStop('connect') || signal?.aborted) {
        logger.info('Connect task interrupted by system signal');
        return { recordsProcessed: connectionsSent };
      }

      // Mid-loop safety check
      if (!(await isSessionValid(page))) {
        throw new Error('Session restricted or expired mid-loop during search processing');
      }

      if (!checkWeeklyLimit('connections', weeklyLimit)) {
        logger.warn('Weekly limit reached during processing. Stopping.');
        break;
      }
      
      if (!(await checkDailyLimit('connections', dailyCap))) {
        logger.info('Daily cap reached during processing. Stopping.');
        dailyLimitHit = true;
        break;
      }

      logger.info(`Evaluating profile: ${profile.name}`);
      
      try {
        // Deep Scrape for high priority keywords or tech roles
        const isHighPriority = profile.headline.toLowerCase().includes('fresher') || 
                               profile.headline.toLowerCase().includes('seeking') ||
                               profile.headline.toLowerCase().includes('looking');
        
        if (isHighPriority || evaluationScoreHeuristic(profile.headline)) {
          await scrapeProfileDetails(page, profile, signal);
        }

        const evaluation = await claudeService.evaluateConnectionTarget(profile);
        logger.info(`Score: ${evaluation.score} - ${evaluation.reason}`);

        if (evaluation.score >= 7) {
          const note = await claudeService.generateConnectionNote(
            profile.name,
            profile.headline,
            profile.company
          );
          
          // Crash protection: Pre-mark as sending
          connectionRepo.upsert(profile.url, 'sending_connection', {
            name: profile.name,
            messageDraftedAt: new Date().toISOString()
          });

          const sent = await sendConnectionRequest(page, profile, evaluation.score, note, keyword, signal);
          if (sent) {
            connectionsSent++;
            await randomDelay(8000, 25000, signal); // Uses new Phase 3 defaults (8-25s)
          } else {
            failed++;
          }
        } else {
          logger.info(`Skipping ${profile.name} (low score)`);
          await randomDelay(3000, 7000, signal);
        }
      } catch (error) {
        if (error instanceof EmergencyStopError || error.message.includes('EmergencyStopError') || error.message.includes('aborted')) {
          logger.info('Connect task aborted gracefully due to emergency stop or timeout.');
          return { recordsProcessed: connectionsSent }; // Stop all processing
        }
        logger.error(`Error processing profile ${profile.name}`, { error: error.message });
        failed++;
      }
    }
    
    if (dailyLimitHit || !checkWeeklyLimit('connections', weeklyLimit)) break;

    logger.info(`Finished keyword "${keyword}". Waiting before next search...`);
    await randomDelay(10000, 20000, signal);
  }

  // Summary logic
  const connections = connectionRepo.findAllConnections();
  const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const sentInLastWeek = connections.filter(e => e.state === 'request_sent' && new Date(e.updated_at).getTime() > oneWeekAgo).length;

  await logSessionSummary({
    runType: "connections",
    connectionsSent,
    failed,
    dailyLimitHit,
    weeklyLimitRemaining: Math.max(0, weeklyLimit - sentInLastWeek)
  });

  return { recordsProcessed: connectionsSent };
}

async function sendConnectionRequest(page, profile, score, note, keyword, signal = null) {
  if (RuntimeStateService.shouldStop('connect') || signal?.aborted) {
    logger.info('Connect task interrupted by system signal');
    return false;
  }
  logger.info(`Sending connection request to ${profile.name}`);
  let success = false;
  let failureReason = null;

  try {
    await page.goto(profile.url, { waitUntil: 'domcontentloaded' });
    await randomDelay(5000, 8000, signal);

    let connectButton = await page.$('button.pvs-profile-actions__action:has-text("Connect")');

    if (!connectButton) {
      const moreButton = await page.$('button[aria-label="More actions"]');
      if (moreButton) {
        await humanClick(moreButton, signal);
        await randomDelay(1000, 2000, signal);
        connectButton = await page.$('div[role="button"]:has-text("Connect")');
      }
    }

    if (!connectButton) {
      logger.warn(`Connect button not found for ${profile.name}`);
      failureReason = 'connect_button_not_found';
    } else {
      await humanClick(connectButton, signal);
      await randomDelay(2000, 4000, signal);

      const addNoteButton = await page.$('button[aria-label="Add a note"]');
      if (!addNoteButton) {
        logger.warn(`"Add a note" button not found for ${profile.name}`);
        failureReason = 'note_dialog_missing';
        const cancelButton = await page.$('button[aria-label="Dismiss"]');
        if (cancelButton) await humanClick(cancelButton, signal);
      } else {
        await humanClick(addNoteButton, signal);
        await randomDelay(2000, 3000, signal);

        const editor = await page.$('textarea[name="message"]');
        if (editor) {
          await humanType(editor, note, signal);
          await randomDelay(2000, 4000, signal);
          const sendButton = await page.$('button[aria-label="Send now"]');
          if (sendButton) await humanClick(sendButton, signal);
          success = true;
          logger.info(`Successfully sent request to ${profile.name}`);
        } else {
          failureReason = 'note_editor_not_found';
        }
      }
    }
  } catch (error) {
    if (error instanceof EmergencyStopError || error.message.includes('EmergencyStopError') || error.message.includes('aborted')) {
      throw error;
    }
    logger.error(`Failed to send connection request to ${profile.name}`, { error: error.message });
    failureReason = `error: ${error.message}`;
  }

  /**
   * Log ALL outcomes (success or failure)
   */
  connectionRepo.upsert(profile.url, success ? 'request_sent' : 'failed', {
    name: profile.name,
    headline: profile.headline,
    company: profile.company,
    score,
    note,
    variant: Math.random() < 0.5 ? 'A' : 'B',
    sourceKeyword: keyword,
    campaign: 'phase4-outbound',
    failureReason: success ? null : failureReason
  });

  return success;
}
