import logger from './logger.js';

export async function sendAlert(message) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.warn('Slack Alert: No SLACK_WEBHOOK_URL found in .env. Skipping alert.');
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `🚨 *LinkedIn Bot Alert*:\n${message}` })
    });

    if (!response.ok) {
      throw new Error(`Slack API responded with ${response.status}`);
    }
    logger.info('Slack alert sent successfully.');
  } catch (error) {
    logger.error('Failed to send Slack alert', { message: error.message });
  }
}
