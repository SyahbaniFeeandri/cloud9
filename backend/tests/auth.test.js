import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

test('Security - Password hashing and verification', async () => {
  const password = 'mySecretPassword123';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);

  assert.notEqual(password, hash);
  const isMatch = await bcrypt.compare(password, hash);
  assert.equal(isMatch, true);

  const isInvalid = await bcrypt.compare('wrongPassword', hash);
  assert.equal(isInvalid, false);
});

test('Security - JWT token creation and verification', () => {
  const secret = 'fincloud_test_secret';
  const payload = { id: 1, email: 'user@fincloud.local', role: 'USER' };

  const token = jwt.sign(payload, secret, { expiresIn: '1h' });
  assert.ok(token);

  const decoded = jwt.verify(token, secret);
  assert.equal(decoded.id, payload.id);
  assert.equal(decoded.email, payload.email);
  assert.equal(decoded.role, payload.role);
});

