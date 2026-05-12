import { test, describe, mock } from 'node:test';
import assert from 'node:assert';
import { sendAlert } from './alerts.js';

describe('AlertService', () => {
  test('sendAlert should call fetch for Slack when SLACK_WEBHOOK_URL is set', async (t) => {
    // Setup env
    const originalUrl = process.env.SLACK_WEBHOOK_URL;
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test';
    
    // Mock fetch
    const fetchMock = t.mock.method(global, 'fetch', () => Promise.resolve({ ok: true }));
    
    try {
      await sendAlert('Test message');
      
      assert.strictEqual(fetchMock.mock.callCount(), 1);
      const [url, options] = fetchMock.mock.calls[0].arguments;
      assert.strictEqual(url, process.env.SLACK_WEBHOOK_URL);
      
      const body = JSON.parse(options.body);
      assert.ok(body.text.includes('Test message'));
    } finally {
      // Restore env
      process.env.SLACK_WEBHOOK_URL = originalUrl;
    }
  });

  test('sendAlert should debounce repeated messages', async (t) => {
    const originalUrl = process.env.SLACK_WEBHOOK_URL;
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test';
    const fetchMock = t.mock.method(global, 'fetch', () => Promise.resolve({ ok: true }));
    
    try {
      await sendAlert('Repeat message');
      await sendAlert('Repeat message');
      
      assert.strictEqual(fetchMock.mock.callCount(), 1);
    } finally {
      process.env.SLACK_WEBHOOK_URL = originalUrl;
    }
  });

  test('sendAlert should NOT debounce different messages', async (t) => {
    const originalUrl = process.env.SLACK_WEBHOOK_URL;
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test';
    const fetchMock = t.mock.method(global, 'fetch', () => Promise.resolve({ ok: true }));
    
    try {
      await sendAlert('Message A');
      await sendAlert('Message B');
      
      assert.strictEqual(fetchMock.mock.callCount(), 2);
    } finally {
      process.env.SLACK_WEBHOOK_URL = originalUrl;
    }
  });

  test('sendAlert should call Telegram API when tokens are set', async (t) => {
    const originalToken = process.env.TELEGRAM_BOT_TOKEN;
    const originalChatId = process.env.TELEGRAM_CHAT_ID;
    const originalSlack = process.env.SLACK_WEBHOOK_URL;
    
    process.env.TELEGRAM_BOT_TOKEN = 'token123';
    process.env.TELEGRAM_CHAT_ID = 'chat456';
    delete process.env.SLACK_WEBHOOK_URL;
    
    const fetchMock = t.mock.method(global, 'fetch', () => Promise.resolve({ ok: true }));
    
    try {
      await sendAlert('Telegram test');
      
      assert.strictEqual(fetchMock.mock.callCount(), 1);
      const [url] = fetchMock.mock.calls[0].arguments;
      assert.ok(url.includes('api.telegram.org/bottoken123/sendMessage'));
    } finally {
      process.env.TELEGRAM_BOT_TOKEN = originalToken;
      process.env.TELEGRAM_CHAT_ID = originalChatId;
      process.env.SLACK_WEBHOOK_URL = originalSlack;
    }
  });
});
