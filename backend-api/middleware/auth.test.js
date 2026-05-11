import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, authMiddleware, activeTokens, getDashboardHash } from './auth.js';

test('Password hashing and verification works', () => {
  const password = 'mysecurepassword';
  const hashed = hashPassword(password);
  
  assert.ok(verifyPassword(password, hashed));
  assert.equal(verifyPassword('wrong', hashed), false);
});

test('getDashboardHash returns a hashed version of DASHBOARD_PASSWORD', () => {
  const originalPass = process.env.DASHBOARD_PASSWORD;
  process.env.DASHBOARD_PASSWORD = 'test-env-pass';
  try {
    const hash = getDashboardHash();
    assert.ok(hash.includes(':'), 'Hash should contain salt separator');
    assert.ok(verifyPassword('test-env-pass', hash), 'Hash should be verifiable');
  } finally {
    process.env.DASHBOARD_PASSWORD = originalPass;
  }
});

test('authMiddleware rejects expired tokens', () => {
  const token = 'expired-token';
  const expiry = Date.now() - 1000; // 1 second ago
  activeTokens.set(token, expiry);

  const req = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
  const res = {
    status(code) {
      assert.equal(code, 401);
      return {
        json(data) {
          assert.equal(data.error, 'Unauthorized');
        }
      };
    }
  };
  let nextCalled = false;
  const next = () => { nextCalled = true; };

  authMiddleware(req, res, next);
  assert.strictEqual(nextCalled, false, 'Next should not be called for expired token');
});

test('authMiddleware accepts valid tokens from Authorization header', () => {
  const token = 'valid-token-header';
  const expiry = Date.now() + 10000; // 10 seconds from now
  activeTokens.set(token, expiry);

  const req = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
  const res = {
    status(code) {
      assert.fail('Should not call status for valid token');
    }
  };
  let nextCalled = false;
  const next = () => { nextCalled = true; };

  authMiddleware(req, res, next);
  assert.strictEqual(nextCalled, true, 'Next should be called for valid token from header');
});

test('authMiddleware accepts valid tokens from session_token cookie', () => {
  const token = 'valid-token-cookie';
  const expiry = Date.now() + 10000; // 10 seconds from now
  activeTokens.set(token, expiry);

  const req = { headers: {}, cookies: { session_token: token } };
  const res = {
    status(code) {
      assert.fail('Should not call status for valid token');
    }
  };
  let nextCalled = false;
  const next = () => { nextCalled = true; };

  authMiddleware(req, res, next);
  assert.strictEqual(nextCalled, true, 'Next should be called for valid token from cookie');
});
