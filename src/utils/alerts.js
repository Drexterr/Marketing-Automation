import logger from './logger.js';

const COOLDOWN_PERIOD = 5 * 60 * 1000; // 5 minutes
const alertHistory = new Map();

/**
 * Sends an alert to configured channels (Slack, Telegram).
 * Includes debouncing to prevent spamming identical messages.
 * 
 * @param {string} message - The message to send
 * @param {string} level - 'info', 'warning', or 'critical'
 */
export async function sendAlert(message, level = 'info') {
  const now = Date.now();
  const historyKey = `${level}:${message}`;
  
  // Debounce logic
  if (alertHistory.has(historyKey) && (now - alertHistory.get(historyKey)) < COOLDOWN_PERIOD) {
    logger.debug(`Alert debounced: [${level}] ${message}`);
    return;
  }
  
  alertHistory.set(historyKey, now);

  const timestamp = new Date().toLocaleString();
  const formattedMessage = `[${level.toUpperCase()}] ${timestamp}: ${message}`;

  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;

  let sent = false;

  // Slack Integration
  if (slackUrl) {
    try {
      const response = await fetch(slackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `🚨 *LinkedIn Bot Alert*:\n${formattedMessage}` })
      });
      if (response.ok) sent = true;
    } catch (error) {
      logger.error('Failed to send Slack alert', { message: error.message });
    }
  }

  // Telegram Integration
  if (telegramToken && telegramChatId) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: `🚨 LinkedIn Bot Alert:\n${formattedMessage}`
        })
      });
      if (response.ok) sent = true;
    } catch (error) {
      logger.error('Failed to send Telegram alert', { message: error.message });
    }
  }

  if (!sent) {
    logger.info(`Alert (Console): ${formattedMessage}`);
  } else {
    logger.info(`Alert sent successfully: [${level}] ${message}`);
  }
}

/**
 * Proactive Alert Service with debouncing and multi-channel support
 */
export const AlertService = {
  sendAlert,
  sendCritical,
  sendWarning
};

/**
 * Convenience method for critical alerts
 */
export async function sendCritical(message) {
  return sendAlert(message, 'critical');
}

/**
 * Convenience method for warning alerts
 */
export async function sendWarning(message) {
  return sendAlert(message, 'warning');
}
