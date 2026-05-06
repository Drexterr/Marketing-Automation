import { LinkedInBrowser } from "./browser.js";
import {
  evaluateConnectionTarget,
  generateConnectionNote,
} from "./claude-service.js";
import { logger } from "./src/utils/logger.js";
import fs from "fs";
import path from "path";

const CONNECTIONS_FILE = path.join(
  process.cwd(),
  "data",
  "connections-sent.json"
);
const WEEKLY_LIMIT = parseInt(process.env.WEEKLY_CONNECTION_LIMIT || "100");

// Search queries optimized for CUE AI's target audience
const SEARCH_QUERIES = [
  "software engineer",
  "software developer",
  "engineering manager",
  "tech lead",
  "product manager startup",
  "recruiter tech",
  "talent acquisition",
  "developer advocate",
  "frontend engineer",
  "backend engineer",
  "full stack developer",
  "job seeker software",
];

function loadConnectionsData() {
  if (fs.existsSync(CONNECTIONS_FILE)) {
    return JSON.parse(fs.readFileSync(CONNECTIONS_FILE, "utf-8"));
  }
  return { weeklyCount: 0, weekStart: null, totalSent: 0, profiles: [] };
}

function saveConnectionsData(data) {
  fs.mkdirSync(path.dirname(CONNECTIONS_FILE), { recursive: true });
  fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(data, null, 2));
}

function isNewWeek(weekStart) {
  if (!weekStart) return true;
  const start = new Date(weekStart);
  const now = new Date();
  const diffDays = (now - start) / (1000 * 60 * 60 * 24);
  return diffDays >= 7;
}

export async function runConnectionTask() {
  const bot = new LinkedInBrowser();

  try {
    await bot.launch();
    await bot.login();

    let data = loadConnectionsData();

    // Reset weekly counter if new week
    if (isNewWeek(data.weekStart)) {
      logger.info("New week detected, resetting connection counter");
      data.weeklyCount = 0;
      data.weekStart = new Date().toISOString();
    }

    if (data.weeklyCount >= WEEKLY_LIMIT) {
      logger.info(
        `Weekly limit of ${WEEKLY_LIMIT} connections already reached. Skipping.`
      );
      return;
    }

    const remaining = WEEKLY_LIMIT - data.weeklyCount;
    logger.info(
      `Starting connection task. Can send ${remaining} more this week.`
    );

    let sentThisRun = 0;

    for (const query of SEARCH_QUERIES) {
      if (data.weeklyCount >= WEEKLY_LIMIT) break;

      logger.info(`Searching for: "${query}"`);

      // Navigate to People search
      const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}&network=%5B%22S%22%2C%22O%22%5D&origin=FACETED_SEARCH`;
      await bot.page.goto(searchUrl, { waitUntil: "networkidle" });
      await bot.randomDelay(2000, 4000);

      // Scroll to load results
      await bot.humanScroll(400);
      await bot.randomDelay(1000, 2000);

      // Find all profile cards
      const profileCards = await bot.page
        .locator(".search-results-container .entity-result")
        .all();
      logger.info(`Found ${profileCards.length} profiles for "${query}"`);

      for (const card of profileCards) {
        if (data.weeklyCount >= WEEKLY_LIMIT) break;

        try {
          // Extract profile info
          const name = await card
            .locator(".entity-result__title-text a span[aria-hidden=true]")
            .first()
            .textContent()
            .catch(() => "Unknown");

          const headline = await card
            .locator(".entity-result__primary-subtitle")
            .first()
            .textContent()
            .catch(() => "");

          const location = await card
            .locator(".entity-result__secondary-subtitle")
            .first()
            .textContent()
            .catch(() => "");

          const profileUrl = await card
            .locator(".entity-result__title-text a")
            .first()
            .getAttribute("href")
            .catch(() => null);

          if (!name || name === "Unknown") continue;
          if (!profileUrl) continue;

          // Skip already contacted
          if (data.profiles.some((p) => p.url === profileUrl)) {
            logger.info(`Skipping already contacted: ${name}`);
            continue;
          }

          const profile = {
            name: name.trim(),
            headline: headline.trim(),
            location: location.trim(),
            url: profileUrl,
          };

          // Check if Connect button exists (not already connected)
          const connectBtn = card.locator('button:has-text("Connect")');
          const hasConnect = await connectBtn.isVisible().catch(() => false);

          if (!hasConnect) continue;

          // Ask Claude if worth connecting
          logger.info(`Evaluating: ${profile.name} - ${profile.headline}`);
          const evaluation = await evaluateConnectionTarget(profile);

          if (!evaluation.connect || evaluation.score < 6) {
            logger.info(
              `Skipping ${profile.name}: ${evaluation.reason} (score: ${evaluation.score})`
            );
            continue;
          }

          logger.info(
            `✓ Good match: ${profile.name} (score: ${evaluation.score})`
          );

          // Generate personalized connection note
          const note = await generateConnectionNote(profile);
          logger.info(`Generated note: "${note}"`);

          // Click Connect
          await connectBtn.click();
          await bot.randomDelay(1000, 2000);

          // Look for "Add a note" option
          const addNoteBtn = bot.page.locator('button:has-text("Add a note")');
          const hasAddNote = await addNoteBtn.isVisible().catch(() => false);

          if (hasAddNote) {
            await addNoteBtn.click();
            await bot.randomDelay(500, 1000);
            const noteTextarea = bot.page.locator(
              '#custom-message, textarea[name="message"]'
            );
            await noteTextarea.fill(note.substring(0, 300)); // LinkedIn limit
            await bot.randomDelay(500, 1000);
          }

          // Send connection
          const sendBtn = bot.page.locator(
            'button:has-text("Send"), button:has-text("Send now")'
          );
          await sendBtn.first().click();
          await bot.randomDelay(2000, 4000);

          // Record success
          data.weeklyCount++;
          data.totalSent++;
          sentThisRun++;
          data.profiles.push({ ...profile, sentAt: new Date().toISOString() });
          saveConnectionsData(data);

          logger.info(
            `✅ Connection sent to ${profile.name} (${data.weeklyCount}/${WEEKLY_LIMIT} this week)`
          );

          // Human-like delay between connections
          await bot.randomDelay(5000, 12000);
        } catch (err) {
          logger.error(`Error processing profile: ${err.message}`);
          continue;
        }
      }

      // Delay between search queries
      await bot.randomDelay(8000, 15000);
    }

    logger.info(
      `Connection task complete. Sent ${sentThisRun} this run, ${data.weeklyCount}/${WEEKLY_LIMIT} this week.`
    );
  } finally {
    await bot.close();
  }
}
