import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, authMiddleware } from './auth.js';

test('Password hashing and verification works', () => {
  const password = 'mysecurepassword';
  const hashed = hashPassword(password);
  
  assert.ok(verifyPassword(password, hashed));
  assert.equal(verifyPassword('wrong', hashed), false);
});
