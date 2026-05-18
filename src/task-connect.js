import logger from './utils/logger.js';
import { randomDelay, randomBetween, checkWeeklyLimit, getDynamicWeeklyLimit, checkDailyLimit, isSessionValid, logSessionSummary, humanType, humanClick, isWithinOperatingHours, EmergencyStopError } from './utils/helpers.js';
import { visionClick, visionFindEditor } from './utils/vision.js';
import * as claudeService from './claude-service.js';
import { RuntimeStateService } from '../backend-api/services/RuntimeStateService.js';
import { ConnectionRepository } from '../shared/repositories/ConnectionRepository.js';
import { ActivityRepository } from '../shared/repositories/ActivityRepository.js';

const connectionRepo = new ConnectionRepository();
const activityRepo = new ActivityRepository();

export async function searchAndExtractProfiles(page, keyword) {
  logger.info(`Searching for: ${keyword}`);
  const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keyword)}&origin=CLUSTER_EXPANSION`;

  try {
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // LinkedIn periodically renames result container classes — try multiple selectors
    const resultSelectors = [
      '.reusable-search__result-container',
      '.search-results-container .entity-result',
      'li.reusable-search__result-container',
      '[data-view-name="search-entity-result-universal-template"]',
      '.search-results__list .entity-result',
      '.entity-result'
    ];

    let found = false;
    for (const sel of resultSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 8000 });
        found = true;
        logger.info(`Search results loaded using selector: ${sel}`);
        break;
      } catch {
        // try next
      }
    }

    if (!found) {
      logger.warn(`No result selector matched for keyword: ${keyword}. Page may require login or selector has changed.`);
      return [];
    }

    await page.evaluate(async () => {
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(resolve => setTimeout(resolve, 2000));
    });

    const profiles = await page.evaluate(() => {
      const results = [];
      const seen = new Set();

      // Collect all candidate card elements — try both old and new LinkedIn DOM
      const containers = Array.from(new Set([
        ...document.querySelectorAll('.reusable-search__result-container'),
        ...document.querySelectorAll('[data-view-name="search-entity-result-universal-template"]'),
        ...document.querySelectorAll('.entity-result')
      ]));

      containers.forEach(container => {
        // Profile URL — must have /in/ path
        const linkEl =
          container.querySelector('.entity-result__title-text a[href*="/in/"]') ||
          container.querySelector('a[href*="/in/"]');
        if (!linkEl) return;

        const url = linkEl.href.split('?')[0];
        if (seen.has(url)) return;
        seen.add(url);

        // Name — try multiple selectors in order of specificity
        const nameEl =
          container.querySelector('.entity-result__title-text a span[aria-hidden="true"]') ||
          container.querySelector('a[href*="/in/"] span[aria-hidden="true"]') ||
          container.querySelector('[data-anonymize="person-name"]') ||
          container.querySelector('.entity-result__title-text') ||
          linkEl;
        const name = nameEl?.innerText?.trim() || linkEl.getAttribute('aria-label')?.trim() || '';
        if (!name || name.length < 2) return;

        // Headline
        const headline =
          container.querySelector('.entity-result__primary-subtitle')?.innerText?.trim() ||
          container.querySelector('[data-anonymize="headline"]')?.innerText?.trim() ||
          '';

        // Company
        const company =
          container.querySelector('.entity-result__secondary-subtitle')?.innerText?.trim() ||
          container.querySelector('[data-anonymize="company-name"]')?.innerText?.trim() ||
          '';

        // Open to Work badge detection
        const cardText = (container.innerText || '').toLowerCase();
        const hasOtwBadge =
          !!container.querySelector('[aria-label*="Open to work" i]') ||
          !!container.querySelector('.open-to-work-banner') ||
          !!container.querySelector('img[alt*="Open to work" i]') ||
          !!container.querySelector('[class*="open-to-work"]') ||
          cardText.includes('open to work') ||
          cardText.includes('#opentowork');

        results.push({ name, headline, company, url, isOpenToWork: hasOtwBadge });
      });
      return results;
    });

    const otwCount = profiles.filter(p => p.isOpenToWork).length;
    logger.info(`Found ${profiles.length} profiles for keyword: ${keyword} (${otwCount} Open to Work)`);

    if (profiles.length === 0) {
      // Capture the actual DOM so we can inspect which selectors are present
      const domSample = await page.evaluate(() => {
        const items = document.querySelectorAll('[data-view-name="search-entity-result-universal-template"], .reusable-search__result-container, .entity-result');
        if (!items.length) return 'NO_RESULT_ELEMENTS_FOUND';
        const first = items[0];
        return {
          outerHTML: first.outerHTML.slice(0, 2000),
          totalItems: items.length
        };
      });
      logger.warn('Zero profiles extracted — DOM sample for debugging', { domSample });
    }

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
      const bodyText = document.body.innerText || '';
      const isOpenToWork =
        !!document.querySelector('[aria-label*="Open to work" i]') ||
        !!document.querySelector('.open-to-work-banner') ||
        !!document.querySelector('img[alt*="Open to work" i]') ||
        !!document.querySelector('[class*="open-to-work"]') ||
        // Profile page shows a green frame around the photo with aria-label
        !!document.querySelector('.pv-top-card-profile-picture__container [aria-label*="Open to work" i]') ||
        bodyText.toLowerCase().includes('#opentowork') ||
        bodyText.toLowerCase().includes('open to work');
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
  RuntimeStateService.setPulse({ status: 'RUNNING', activeTask: 'connect', progressPercent: 0 });

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

    let rawProfiles = await searchAndExtractProfiles(page, keyword);

    // Filter by target titles if set — match against headline
    const targetTitles = (process.env.TARGET_TITLES || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    if (targetTitles.length > 0) {
      rawProfiles = rawProfiles.filter(p =>
        targetTitles.some(t => (p.headline || '').toLowerCase().includes(t))
      );
      logger.info(`Title filter applied — ${rawProfiles.length} profiles match [${targetTitles.join(', ')}]`);
    }

    // Open to Work profiles get processed first as priority audience
    const profiles = [
      ...rawProfiles.filter(p => p.isOpenToWork),
      ...rawProfiles.filter(p => !p.isOpenToWork)
    ];

    if (rawProfiles.some(p => p.isOpenToWork)) {
      logger.info(`Prioritizing ${rawProfiles.filter(p => p.isOpenToWork).length} Open to Work profiles`);
    }

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
      RuntimeStateService.updatePulse({ activeTask: `connect: evaluating ${profile.name}` });

      try {
        // Deep-scrape Open to Work profiles always, plus high-priority headline keywords
        const isHighPriority = profile.isOpenToWork ||
                               profile.headline.toLowerCase().includes('fresher') ||
                               profile.headline.toLowerCase().includes('seeking') ||
                               profile.headline.toLowerCase().includes('looking');

        if (isHighPriority || evaluationScoreHeuristic(profile.headline)) {
          await scrapeProfileDetails(page, profile, signal);
        }

        const evaluation = await claudeService.evaluateConnectionTarget(profile);
        // Boost score for Open to Work profiles — they are the primary target audience
        if (profile.isOpenToWork && evaluation.score >= 5) {
          evaluation.score = Math.min(10, evaluation.score + 2);
          evaluation.reason = `[Open to Work] ${evaluation.reason}`;
        }
        logger.info(`Score: ${evaluation.score} - ${evaluation.reason}${profile.isOpenToWork ? ' [OTW priority]' : ''}`);
        activityRepo.log('profile_evaluated', 'connect', { name: profile.name, score: evaluation.score, reason: evaluation.reason, openToWork: profile.isOpenToWork });

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

          RuntimeStateService.updatePulse({ activeTask: `connect: sending to ${profile.name}` });
          const sent = await sendConnectionRequest(page, profile, evaluation.score, note, keyword, signal);
          if (sent) {
            connectionsSent++;
            RuntimeStateService.updatePulse({ activeTask: `connect: sent ${connectionsSent} today` });
            await randomDelay(8000, 25000, signal);
          } else {
            failed++;
          }
        } else {
          logger.info(`Skipping ${profile.name} (low score)`);
          activityRepo.log('profile_skipped', 'connect', { name: profile.name, score: evaluation.score, reason: evaluation.reason });
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

  RuntimeStateService.setPulse({ status: 'IDLE', activeTask: null, progressPercent: 100 });
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

    // Try stable aria-label first, fall back to vision
    let clicked = false;
    for (const sel of ['button[aria-label="Connect"]', 'button[aria-label*="Connect" i]']) {
      const btn = await page.$(sel);
      if (btn && await btn.isVisible().catch(() => false)) {
        await humanClick(btn, signal);
        clicked = true;
        logger.info('Connect button found via aria-label');
        break;
      }
    }

    if (!clicked) {
      // Try "More actions" dropdown via aria-label, then vision
      const moreBtn = await page.$('button[aria-label="More actions"], button[aria-label*="More actions" i]');
      if (moreBtn) {
        await humanClick(moreBtn, signal);
        await randomDelay(800, 1500, signal);
        const dropdownConnect = await page.$('[role="menuitem"]:has-text("Connect"), .artdeco-dropdown__content button:has-text("Connect")');
        if (dropdownConnect) {
          await humanClick(dropdownConnect, signal);
          clicked = true;
        }
      }
    }

    if (!clicked) {
      logger.info('Stable selectors missed — using vision to find Connect button');
      clicked = await visionClick(page, `the "Connect" button in the profile action buttons area for ${profile.name}`);
    }

    if (!clicked) {
      failureReason = 'connect_button_not_found';
    } else {
      await randomDelay(2000, 4000, signal);

      // "Add a note" button — try aria-label, then vision
      let noteClicked = false;
      const addNoteBtn = await page.$('button[aria-label="Add a note"]');
      if (addNoteBtn) {
        await humanClick(addNoteBtn, signal);
        noteClicked = true;
      } else {
        noteClicked = await visionClick(page, '"Add a note" button in the connection request dialog');
      }

      if (!noteClicked) {
        failureReason = 'note_dialog_missing';
        const cancelBtn = await page.$('button[aria-label="Dismiss"], button[aria-label*="Dismiss" i]');
        if (cancelBtn) await humanClick(cancelBtn, signal);
      } else {
        await randomDelay(1500, 2500, signal);

        const editor = await visionFindEditor(page, 5000);
        if (editor) {
          await humanType(editor, note, signal);
          await randomDelay(2000, 4000, signal);

          // Send — try aria-label, then vision
          let sent = false;
          const sendBtn = await page.$('button[aria-label="Send now"], button[aria-label*="Send" i]');
          if (sendBtn) {
            await humanClick(sendBtn, signal);
            sent = true;
          } else {
            sent = await visionClick(page, '"Send now" or "Send" button in the connection request dialog');
          }
          success = sent;
          if (sent) logger.info(`Successfully sent request to ${profile.name}`);
          else failureReason = 'send_button_not_found';
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

  activityRepo.log(
    success ? 'connection_sent' : 'connection_failed',
    'connect',
    { name: profile.name, headline: profile.headline, score, status: success ? 'success' : 'failure', failureReason: success ? null : failureReason }
  );

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
