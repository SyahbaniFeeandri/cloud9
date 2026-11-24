import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReceiptUrl, presignObject, MINIO_BUCKET } from '../src/config/storage.js';

test('Storage - canonical receipt URL keeps the bucket path', () => {
  const url = buildReceiptUrl('receipts/1/example.png');
  assert.equal(url, `/storage/${MINIO_BUCKET}/receipts/1/example.png`);
});

test('Storage - presigned URL contains a signature and the object key', async () => {
  const url = await presignObject('receipts/1/example.png');
  assert.match(url, /^https?:\/\//);
  assert.match(url, /X-Amz-Signature=/);
  assert.match(url, /X-Amz-Expires=/);
  assert.match(url, /example\.png/);
});

test('Storage - presigned URL rejects an empty key', async () => {
  const url = await presignObject('');
  assert.equal(url, null);
});
