import test from 'node:test';
import assert from 'node:assert/strict';

// Configure the public edge URL before importing the storage module, because
// endpoints and the path prefix are resolved at module load time.
process.env.MINIO_PUBLIC_ENDPOINT = 'localhost';
process.env.MINIO_PUBLIC_PORT = '8080';
process.env.MINIO_PUBLIC_PATH_PREFIX = '/storage';
process.env.MINIO_ACCESS_KEY = 'test-access-key';
process.env.MINIO_SECRET_KEY = 'test-secret-key';

const { presignObject, buildReceiptUrl, storageConfig } = await import('../src/config/storage.js');

test('Storage - public config exposes the edge endpoint and prefix', () => {
  assert.equal(storageConfig.publicEndpoint, 'http://localhost:8080');
  assert.equal(storageConfig.publicPathPrefix, '/storage');
});

test('Storage - presigned URL is routed through the public /storage prefix', async () => {
  const url = await presignObject('receipts/1/example.png');
  const parsed = new URL(url);

  assert.equal(parsed.host, 'localhost:8080');
  assert.equal(parsed.pathname, '/storage/fincloud-receipts/receipts/1/example.png');
  assert.match(parsed.search, /X-Amz-Signature=/);
  assert.match(parsed.search, /X-Amz-Expires=/);
});

test('Storage - canonical receipt path stays relative', () => {
  assert.equal(
    buildReceiptUrl('receipts/1/example.png'),
    '/storage/fincloud-receipts/receipts/1/example.png'
  );
});

test('Storage - presigned URL follows the HTTPS request origin from the edge', async () => {
  const req = {
    headers: {
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'localhost:8443'
    },
    protocol: 'http',
    get: () => 'backend:5000'
  };

  const url = await presignObject('receipts/1/example.png', undefined, req);
  const parsed = new URL(url);

  assert.equal(parsed.origin, 'https://localhost:8443');
  assert.equal(parsed.pathname, '/storage/fincloud-receipts/receipts/1/example.png');
  assert.match(parsed.search, /X-Amz-Signature=/);
});

test('Storage - presigned URL follows the HTTP request origin from the edge', async () => {
  const req = {
    headers: {
      'x-forwarded-proto': 'http',
      'x-forwarded-host': 'localhost:8080'
    },
    protocol: 'http',
    get: () => 'backend:5000'
  };

  const url = await presignObject('receipts/1/example.png', undefined, req);
  assert.equal(new URL(url).origin, 'http://localhost:8080');
});
