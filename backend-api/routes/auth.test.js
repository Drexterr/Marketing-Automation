import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import router from './auth.js';
import { activeTokens, getDashboardHash } from '../middleware/auth.js';

test('POST /login succeeds with correct password', async () => {
  process.env.DASHBOARD_PASSWORD = 'correct-password';
  const req = {
    body: { password: 'correct-password' },
    ip: '127.0.0.1'
  };
  
  let statusCode = 0;
  let responseData = null;
  let cookieSet = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    cookie(name, value, options) {
      cookieSet = { name, value, options };
      return this;
    }
  };

  // We need to call the route handler manually or use a mock app
  // Since it's a router, we can find the specific handler
  const layer = router.stack.find(l => l.route && l.route.path === '/login');
  const handler = layer.route.stack[layer.route.stack.length - 1].handle;

  await handler(req, res);

  assert.strictEqual(responseData.success, true);
  assert.ok(cookieSet, 'Cookie should be set');
  assert.strictEqual(cookieSet.name, 'session_token');
});

test('POST /login fails with incorrect password', async () => {
  process.env.DASHBOARD_PASSWORD = 'correct-password';
  const req = {
    body: { password: 'wrong-password' },
    ip: '127.0.0.1'
  };
  
  let statusCode = 0;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    }
  };

  const layer = router.stack.find(l => l.route && l.route.path === '/login');
  const handler = layer.route.stack[layer.route.stack.length - 1].handle;

  await handler(req, res);

  assert.strictEqual(statusCode, 401);
  assert.strictEqual(responseData.error, 'Invalid credentials');
});
