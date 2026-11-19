import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  DeleteBucketPolicyCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';

dotenv.config();

export const MINIO_BUCKET = process.env.MINIO_BUCKET || 'fincloud-receipts';

const REGION = process.env.MINIO_REGION || 'us-east-1';
const PRESIGN_EXPIRES = clampExpiry(parseInt(process.env.MINIO_PRESIGN_EXPIRES || '3600', 10));

// Internal endpoint: how the backend reaches MinIO (e.g. the `minio` service
// name inside Docker Compose).
const INTERNAL_ENDPOINT = buildEndpoint(
  process.env.MINIO_ENDPOINT || '127.0.0.1',
  process.env.MINIO_PORT || '9000',
  process.env.MINIO_USE_SSL
);

// Public endpoint: how the browser reaches MinIO. It must be resolvable from
// the user's machine (localhost for local Docker, a domain/IP in production).
const PUBLIC_ENDPOINT = buildEndpoint(
  process.env.MINIO_PUBLIC_ENDPOINT || process.env.MINIO_ENDPOINT || '127.0.0.1',
  process.env.MINIO_PUBLIC_PORT || process.env.MINIO_PORT || '9000',
  process.env.MINIO_PUBLIC_USE_SSL ?? process.env.MINIO_USE_SSL
);

// Optional path prefix added after signing (e.g. /storage when MinIO is only
// reachable through the central Nginx edge). The edge strips the prefix
// before proxying, so the SigV4 canonical URI remains valid.
const PUBLIC_PATH_PREFIX = normalizePathPrefix(process.env.MINIO_PUBLIC_PATH_PREFIX);

const credentials = {
  accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
};

const clientOptions = {
  region: REGION,
  forcePathStyle: true,
  credentials
};

// Used for real operations (upload, download, delete, bucket management).
const internalClient = new S3Client({
  ...clientOptions,
  endpoint: INTERNAL_ENDPOINT
});

// Used only to sign URLs with the host the browser will actually call.
// One client is kept per public endpoint so requests made through HTTP and
// HTTPS (or through different hostnames) are signed for the correct origin.
const publicClients = new Map();

function getPublicClient(endpoint) {
  if (!publicClients.has(endpoint)) {
    publicClients.set(endpoint, new S3Client({
      ...clientOptions,
      endpoint
    }));
  }
  return publicClients.get(endpoint);
}

/**
 * Resolves the browser-facing storage origin for a request.
 *
 * Requests coming through the Nginx edge carry X-Forwarded-* headers, so a
 * page served over HTTPS gets HTTPS receipt URLs (and a page served over HTTP
 * gets HTTP ones). Direct backend calls fall back to MINIO_PUBLIC_ENDPOINT.
 */
function resolvePublicEndpoint(req) {
  if (!req) return PUBLIC_ENDPOINT;

  const forwardedProto = req.headers?.['x-forwarded-proto'];
  const forwardedHost = req.headers?.['x-forwarded-host'];
  if (!forwardedProto && !forwardedHost) return PUBLIC_ENDPOINT;

  const protocol = String(forwardedProto || req.protocol || 'http')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const host = String(forwardedHost || req.get?.('host') || '').trim();

  if (!host || (protocol !== 'http' && protocol !== 'https')) {
    return PUBLIC_ENDPOINT;
  }

  return `${protocol}://${host}`;
}

let bucketReady = false;

function buildEndpoint(host, port, useSsl) {
  const secure = String(useSsl || 'false').toLowerCase() === 'true';
  const protocol = secure ? 'https' : 'http';
  const value = String(host || '').trim().replace(/\/+$/, '');
  if (!value) return `${protocol}://127.0.0.1:${port}`;
  // Allow passing a full URL in the env var as well as a bare hostname.
  if (/^https?:\/\//i.test(value)) return value.replace(/\/+$/, '');
  return `${protocol}://${value}:${port}`;
}

function normalizePathPrefix(value) {
  const prefix = String(value || '').trim().replace(/\/+$/, '');
  if (!prefix) return '';
  return prefix.startsWith('/') ? prefix : `/${prefix}`;
}

/**
 * Inserts the public path prefix into an already-signed URL.
 *
 * SigV4 presigned URLs sign the canonical URI and Host header, not the full
 * URL string. Adding a prefix that the reverse proxy later strips keeps the
 * signature valid while exposing storage only through the edge.
 */
function withPublicPrefix(url) {
  if (!PUBLIC_PATH_PREFIX) return url;

  const schemeEnd = url.indexOf('://');
  if (schemeEnd === -1) return url;

  const pathStart = url.indexOf('/', schemeEnd + 3);
  if (pathStart === -1) return url;

  const pathname = url.slice(pathStart);
  if (pathname === PUBLIC_PATH_PREFIX || pathname.startsWith(`${PUBLIC_PATH_PREFIX}/`)) {
    return url;
  }

  // Preserve the signed query string byte-for-byte.
  return `${url.slice(0, pathStart)}${PUBLIC_PATH_PREFIX}${pathname}`;
}

function clampExpiry(seconds) {
  if (!Number.isFinite(seconds)) return 3600;
  return Math.min(Math.max(seconds, 60), 7 * 24 * 60 * 60);
}

function isNotFound(error) {
  return error?.$metadata?.httpStatusCode === 404 ||
    error?.name === 'NotFound' ||
    error?.name === 'NoSuchBucket';
}

function isNoSuchPolicy(error) {
  return error?.name === 'NoSuchBucketPolicy' ||
    error?.Code === 'NoSuchBucketPolicy' ||
    error?.$metadata?.httpStatusCode === 404;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates the receipts bucket when missing and removes any legacy public-read
 * policy. Objects are private and only reachable through presigned URLs.
 */
export async function ensureBucket(retries = 10, delayMs = 2000) {
  if (bucketReady) return true;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      try {
        await internalClient.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET }));
      } catch (error) {
        if (!isNotFound(error)) throw error;
        await internalClient.send(new CreateBucketCommand({ Bucket: MINIO_BUCKET }));
        console.log(`[Storage] Bucket "${MINIO_BUCKET}" created`);
      }

      // Migrating from the old public-read setup: drop the policy so anonymous
      // requests are rejected and presigned URLs become the only access path.
      try {
        await internalClient.send(new DeleteBucketPolicyCommand({ Bucket: MINIO_BUCKET }));
      } catch (policyError) {
        if (!isNoSuchPolicy(policyError)) {
          console.warn('[Storage] Could not clear bucket policy:', policyError.message);
        }
      }

      console.log(`[Storage] Bucket "${MINIO_BUCKET}" ready (private, presigned URLs)`);
      bucketReady = true;
      return true;
    } catch (error) {
      console.warn(`[Storage] Init attempt ${attempt}/${retries} failed: ${error.message}`);
      if (attempt === retries) throw error;
      await sleep(delayMs);
    }
  }

  return false;
}

export async function uploadObject(objectKey, body, contentType) {
  await internalClient.send(new PutObjectCommand({
    Bucket: MINIO_BUCKET,
    Key: objectKey,
    Body: body,
    ContentType: contentType || 'application/octet-stream'
  }));
}

export async function deleteObject(objectKey) {
  await internalClient.send(new DeleteObjectCommand({
    Bucket: MINIO_BUCKET,
    Key: objectKey
  }));
}

export async function getObjectStream(objectKey) {
  const response = await internalClient.send(new GetObjectCommand({
    Bucket: MINIO_BUCKET,
    Key: objectKey
  }));
  return {
    stream: response.Body,
    contentType: response.ContentType || 'application/octet-stream',
    contentLength: response.ContentLength
  };
}

/**
 * Generates a time-limited GET URL using the public MinIO endpoint.
 * The signature covers the host, so the URL must be signed with the same
 * hostname the browser will use.
 */
export function presignObject(objectKey, expiresIn = PRESIGN_EXPIRES, req = null) {
  if (!objectKey) return null;
  return getSignedUrl(
    getPublicClient(resolvePublicEndpoint(req)),
    new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: objectKey }),
    { expiresIn: clampExpiry(expiresIn) }
  ).then(withPublicPrefix);
}

export function buildReceiptUrl(objectKey) {
  return `/storage/${MINIO_BUCKET}/${objectKey}`;
}

export async function getStorageStatus(timeoutMs = 2500) {
  try {
    await Promise.race([
      internalClient.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET })),
      new Promise((resolve, reject) =>
        setTimeout(() => reject(new Error('Storage health check timed out')), timeoutMs)
      )
    ]);

    return { connected: true, bucket: MINIO_BUCKET };
  } catch (error) {
    return { connected: false, bucket: MINIO_BUCKET, error: error.message };
  }
}

export const storageConfig = {
  bucket: MINIO_BUCKET,
  internalEndpoint: INTERNAL_ENDPOINT,
  publicEndpoint: PUBLIC_ENDPOINT,
  publicPathPrefix: PUBLIC_PATH_PREFIX,
  presignExpires: PRESIGN_EXPIRES
};
