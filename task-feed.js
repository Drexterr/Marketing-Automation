import { LinkedInBrowser } from "./browser.js";
import { generateFeedComment } from "./claude-service.js";
import { logger } from "./src/utils/logger.js";
import fs from "fs";
import path from "path";

const COMMENTS_FILE = path.join(process.cwd(), "data", "comments-sent.json");
const MAX_COMMENTS_PER_SESSION = 10;

function loadCommentsData() {
  if (fs.existsSync(COMMENTS_FILE)) {
    return JSON.parse(fs.readFileSync(COMMENTS_FILE, "utf-8"));
  }
  return { commented: [], totalComments: 0 };
}

function saveCommentsData(data) {
  fs.mkdirSync(path.dirname(COMMENTS_FILE), { recursive: true });
  fs.writeFileSync(COMMENTS_FILE, JSON.stringify(data, null, 2));
}

export async function runFeedTask() {
  const bot = new LinkedInBrowser();

  try {
    await bot.launch();
    await bot.login();

    const data = loadCommentsData();
    let commentedThisSession = 0;

    logger.info("Loading LinkedIn feed...");
    await bot.page.goto("https://www.linkedin.com/feed/", {
      waitUntil: "networkidle",
    });
    await bot.randomDelay(2000, 4000);

    let scrollCount = 0;
    const maxScrolls = 20;

    while (
      commentedThisSession < MAX_COMMENTS_PER_SESSION &&
      scrollCount < maxScrolls
    ) {
      // Find visible posts
      const posts = await bot.page
        .locator(".feed-shared-update-v2, .occludable-update")
        .all();

      logger.info(`Found ${posts.length} posts in view`);

      for (const post of posts) {
        if (commentedThisSession >= MAX_COMMENTS_PER_SESSION) break;

        try {
          // Get post ID to avoid duplicate comments
          const postUrn = await post
            .getAttribute("data-urn")
            .catch(() => null);
          
          if (postUrn && data.commented.includes(postUrn)) continue;

          // Extract post content
          const content = await post
            .locator(".feed-shared-update-v2__description, .update-components-text")
            .first()
            .textContent()
            .catch(() => "");

          if (!content || content.length < 50) continue;

          // Extract author info
          const author = await post
            .locator(".update-components-actor__name, .feed-shared-actor__name")
            .first()
            .textContent()
            .catch(() => "Unknown");

          const authorHeadline = await post
            .locator(".update-components-actor__description, .feed-shared-actor__description")
            .first()
            .textContent()
            .catch(() => "");

          logger.info(`Evaluating post by ${author.trim()}: "${content.substring(0, 80)}..."`);

          // Ask Claude to evaluate and generate comment
          const result = await generateFeedComment({
            author: author.trim(),
            authorHeadline: authorHeadline.trim(),
            content: content.trim().substring(0, 1000),
          });

          if (!result.comment || result.score < 6) {
            logger.info(`Skipping post by ${author.trim()} (score: ${result.score}): ${result.reason}`);
            if (postUrn) data.commented.push(postUrn + "_skipped");
            continue;
          }

          logger.info(`✓ Worth commenting (score: ${result.score}): "${result.comment}"`);

          // Find and click comment button
          const commentBtn = post.locator(
            'button[aria-label*="comment"], button:has-text("Comment")'
          );
          const hasCommentBtn = await commentBtn.isVisible().catch(() => false);

          if (!hasCommentBtn) continue;

          await commentBtn.click();
          await bot.randomDelay(1500, 3000);

          // Find comment input
          const commentInput = post.locator(
            '.comments-comment-box__form .ql-editor, .comments-comment-texteditor .ql-editor'
          );
          const hasInput = await commentInput.isVisible().catch(() => false);

          if (!hasInput) {
            // Try page-level input
            const pageInput = bot.page.locator('.ql-editor[contenteditable=true]').last();
            await pageInput.click();
            await bot.randomDelay(500, 1000);
            
            for (const char of result.comment) {
              await pageInput.type(char, { delay: 20 + Math.random() * 40 });
            }
          } else {
            await commentInput.click();
            await bot.randomDelay(500, 1000);

            for (const char of result.comment) {
              await commentInput.type(char, { delay: 20 + Math.random() * 40 });
            }
          }

          await bot.randomDelay(1500, 3000);

          // Submit comment
          const submitBtn = post.locator(
            'button[type="submit"]:has-text("Post"), .comments-comment-box__submit-button'
          );
          const hasSubmit = await submitBtn.isVisible().catch(() => false);

          if (hasSubmit) {
            await submitBtn.click();
          } else {
            await bot.page.keyboard.press("Control+Enter");
          }

          await bot.randomDelay(2000, 4000);

          if (postUrn) data.commented.push(postUrn);
          data.totalComments++;
          commentedThisSession++;
          saveCommentsData(data);

          logger.info(
            `✅ Commented on post by ${author.trim()} (${commentedThisSession}/${MAX_COMMENTS_PER_SESSION} this session)`
          );

          // Human delay between comments
          await bot.randomDelay(15000, 30000);
        } catch (err) {
          logger.error(`Error processing post: ${err.message}`);
          continue;
        }
      }

      // Scroll down to load more posts
      await bot.humanScroll(800);
      scrollCount++;
      await bot.randomDelay(2000, 4000);
    }

    logger.info(
      `Feed task complete. Made ${commentedThisSession} comments this session.`
    );
  } finally {
    await bot.close();
  }
}
