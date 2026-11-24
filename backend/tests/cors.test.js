import test from 'node:test';
import assert from 'node:assert/strict';
import { createCorsOptions, parseOrigins } from '../src/middleware/cors.js';

function checkOrigin(options, origin) {
  return new Promise((resolve) => {
    options.origin(origin, (error, allowed) => resolve({ error, allowed }));
  });
}

test('CORS - parses a comma-separated allowlist and trims blanks', () => {
  assert.deepEqual(
    parseOrigins(' http://localhost:3000, https://localhost:8443 ,, '),
    ['http://localhost:3000', 'https://localhost:8443']
  );
});

test('CORS - requests without an Origin header are allowed', async () => {
  const result = await checkOrigin(createCorsOptions('https://app.example.test'), undefined);
  assert.equal(result.error, null);
  assert.equal(result.allowed, true);
});

test('CORS - an allowlisted browser origin is accepted', async () => {
  const options = createCorsOptions('http://localhost:3000,https://localhost:8443');
  const result = await checkOrigin(options, 'https://localhost:8443');
  assert.equal(result.allowed, true);
});

test('CORS - an unknown browser origin is rejected', async () => {
  const options = createCorsOptions('https://app.example.test');
  const result = await checkOrigin(options, 'https://evil.example.test');
  assert.equal(result.allowed, false);
});

test('CORS - a wildcard keeps development tunnels working', async () => {
  const options = createCorsOptions('*');
  const result = await checkOrigin(options, 'https://random-tunnel.loca.lt');
  assert.equal(result.allowed, true);
});
