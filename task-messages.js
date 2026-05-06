import { LinkedInBrowser } from "./browser.js";
import {
  generateMessageReply,
  generateFirstMessage,
} from "./claude-service.js";
import { logger } from "./src/utils/logger.js";
import fs from "fs";
import path from "path";

const MESSAGES_FILE = path.join(process.cwd(), "data", "messages-sent.json");

function loadMessagesData() {
  if (fs.existsSync(MESSAGES_FILE)) {
    return JSON.parse(fs.readFileSync(MESSAGES_FILE, "utf-8"));
  }
  return { replied: [], firstMessageSent: [] };
}

function saveMessagesData(data) {
  fs.mkdirSync(path.dirname(MESSAGES_FILE), { recursive: true });
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(data, null, 2));
}

export async function runMessagesTask() {
  const bot = new LinkedInBrowser();

  try {
    await bot.launch();
    await bot.login();

    const data = loadMessagesData();

    logger.info("Navigating to messages...");
    await bot.page.goto("https://www.linkedin.com/messaging/", {
      waitUntil: "networkidle",
    });
    await bot.randomDelay(2000, 3000);

    // Get all unread conversations
    const conversations = await bot.page
      .locator(".msg-conversation-listitem")
      .all();
    logger.info(`Found ${conversations.length} conversations`);

    let repliedCount = 0;

    for (const conv of conversations) {
      try {
        // Check if unread
        const isUnread = await conv
          .locator(".msg-conversation-listitem__unread-count")
          .isVisible()
          .catch(() => false);

        const senderName = await conv
          .locator(".msg-conversation-listitem__participant-names span")
          .first()
          .textContent()
          .catch(() => "Unknown");

        // Get conversation ID to avoid double-replying
        const convId = await conv
          .getAttribute("data-conversation-id")
          .catch(() => null);

        if (convId && data.replied.includes(convId)) {
          continue;
        }

        if (!isUnread) continue;

        logger.info(`Opening conversation with: ${senderName}`);
        await conv.click();
        await bot.randomDelay(1500, 3000);

        // Extract messages from this conversation
        const messageElements = await bot.page
          .locator(".msg-s-message-list__event")
          .all();

        const messages = [];
        for (const msgEl of messageElements) {
          const text = await msgEl
            .locator(".msg-s-event-listitem__body")
            .textContent()
            .catch(() => "");
          const isOwn = await msgEl
            .locator(".msg-s-message-group--right")
            .isVisible()
            .catch(() => false);
          if (text.trim()) {
            messages.push({
              sender: isOwn ? "me" : senderName,
              text: text.trim(),
            });
          }
        }

        if (messages.length === 0) continue;

        // Get the last message - if it's from us, skip
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.sender === "me") {
          logger.info(`Last message was ours, skipping ${senderName}`);
          continue;
        }

        // Generate AI reply
        logger.info(`Generating reply for ${senderName}...`);
        const reply = await generateMessageReply({
          senderName: senderName.trim(),
          senderHeadline: "",
          messages,
        });

        logger.info(`Reply: "${reply}"`);

        // Type and send reply
        const messageInput = bot.page.locator(
          ".msg-form__contenteditable, div[contenteditable=true][aria-label*='message']"
        );
        await messageInput.first().click();
        await bot.randomDelay(500, 1000);

        // Type naturally
        for (const char of reply) {
          await messageInput.first().type(char, { delay: 30 + Math.random() * 40 });
        }

        await bot.randomDelay(1000, 2000);
        await bot.page.keyboard.press("Enter");
        await bot.randomDelay(1500, 3000);

        if (convId) data.replied.push(convId);
        saveMessagesData(data);
        repliedCount++;

        logger.info(`✅ Replied to ${senderName}`);
        await bot.randomDelay(3000, 7000);
      } catch (err) {
        logger.error(`Error handling conversation: ${err.message}`);
        continue;
      }
    }

    logger.info(`Messages task complete. Replied to ${repliedCount} messages.`);
  } finally {
    await bot.close();
  }
}

/**
 * Send first message to new connections
 */
export async function sendFirstMessages(profiles) {
  const bot = new LinkedInBrowser();

  try {
    await bot.launch();
    await bot.login();

    const data = loadMessagesData();

    for (const profile of profiles) {
      if (data.firstMessageSent.includes(profile.url)) continue;

      try {
        logger.info(`Sending first message to ${profile.name}...`);

        // Visit their profile
        await bot.page.goto(profile.url, { waitUntil: "networkidle" });
        await bot.randomDelay(2000, 4000);

        // Get more profile details for better personalization
        const about = await bot.page
          .locator("#about ~ .pvs-list__outer-container .pvs-list__item--line-separated span[aria-hidden=true]")
          .first()
          .textContent()
          .catch(() => "");

        profile.about = about;

        // Generate personalized first message
        const message = await generateFirstMessage(profile);
        logger.info(`First message: "${message}"`);

        // Click Message button on their profile
        const msgBtn = bot.page.locator('a:has-text("Message"), button:has-text("Message")').first();
        const hasMsgBtn = await msgBtn.isVisible().catch(() => false);

        if (!hasMsgBtn) {
          logger.warn(`No message button for ${profile.name}`);
          continue;
        }

        await msgBtn.click();
        await bot.randomDelay(2000, 3000);

        // Type message
        const messageInput = bot.page.locator(".msg-form__contenteditable, div[contenteditable=true][aria-label*='message']");
        await messageInput.first().click();
        await bot.randomDelay(500, 1000);

        for (const char of message) {
          await messageInput.first().type(char, { delay: 25 + Math.random() * 45 });
        }

        await bot.randomDelay(1500, 2500);
        await bot.page.keyboard.press("Enter");
        await bot.randomDelay(2000, 4000);

        data.firstMessageSent.push(profile.url);
        saveMessagesData(data);

        logger.info(`✅ First message sent to ${profile.name}`);
        await bot.randomDelay(8000, 15000);
      } catch (err) {
        logger.error(`Error sending first message to ${profile.name}: ${err.message}`);
      }
    }
  } finally {
    await bot.close();
  }
}
