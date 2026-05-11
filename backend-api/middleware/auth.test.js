import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, authMiddleware, activeTokens } from './auth.js';

test('Password hashing and verification works', () => {
  const password = 'mysecurepassword';
  const hashed = hashPassword(password);
  
  assert.ok(verifyPassword(password, hashed));
  assert.equal(verifyPassword('wrong', hashed), false);
});

test('authMiddleware rejects expired tokens', () => {
  const token = 'expired-token';
  const expiry = Date.now() - 1000; // 1 second ago
  activeTokens.set(token, expiry);

  const req = { headers: { authorization: `Bearer ${token}` } };
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

test('authMiddleware accepts valid tokens', () => {
  const token = 'valid-token';
  const expiry = Date.now() + 10000; // 10 seconds from now
  activeTokens.set(token, expiry);

  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = {
    status(code) {
      assert.fail('Should not call status for valid token');
    }
  };
  let nextCalled = false;
  const next = () => { nextCalled = true; };

  authMiddleware(req, res, next);
  assert.strictEqual(nextCalled, true, 'Next should be called for valid token');
});
