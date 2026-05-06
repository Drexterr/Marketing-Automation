import logger from './utils/logger.js';
import { randomDelay, logAction, checkWeeklyLimit } from './utils/helpers.js';
import * as claudeService from './claude-service.js';
import path from 'path';

const CONNECTIONS_SENT_FILE = path.join(process.cwd(), 'data', 'connections-sent.json');

/**
 * Searches for profiles on LinkedIn and extracts basic data.
 */
export async function searchAndExtractProfiles(page, keyword) {
  logger.info(`Searching for: ${keyword}`);
  const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keyword)}&origin=CLUSTER_EXPANSION`;
  
  try {
    await page.goto(searchUrl, { waitUntil: 'networkidle' });
    await page.waitForSelector('.reusable-search__result-container', { timeout: 15000 });

    // Scroll to load all results
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
        const linkElement = container.querySelector('.entity-result__title-text a');
        
        if (nameElement && headlineElement && linkElement) {
          results.push({
            name: nameElement.innerText.trim(),
            headline: headlineElement.innerText.trim(),
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
