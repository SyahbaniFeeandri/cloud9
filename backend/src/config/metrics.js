import client from 'prom-client';

/**
 * Central Prometheus registry.
 * All custom and default metrics are registered here so `/metrics` exposes a
 * single, consistent snapshot for Prometheus to scrape.
 */
export const registry = new client.Registry();

client.collectDefaultMetrics({
  register: registry,
  prefix: 'fincloud_'
});

export const httpRequestsTotal = new client.Counter({
  name: 'fincloud_http_requests_total',
  help: 'Total HTTP requests handled by the FinCloud API',
  labelNames: ['method', 'route', 'status'],
  registers: [registry]
});

export const httpRequestDuration = new client.Histogram({
  name: 'fincloud_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry]
});

export const transactionsCreatedTotal = new client.Counter({
  name: 'fincloud_transactions_created_total',
  help: 'Total transactions created through the API',
  labelNames: ['type'],
  registers: [registry]
});

export const receiptUploadsTotal = new client.Counter({
  name: 'fincloud_receipt_uploads_total',
  help: 'Receipt upload attempts handled by the API',
  labelNames: ['result'],
  registers: [registry]
});

export const receiptUploadBytesTotal = new client.Counter({
  name: 'fincloud_receipt_upload_bytes_total',
  help: 'Total bytes uploaded for receipt files',
  registers: [registry]
});

export const authAttemptsTotal = new client.Counter({
  name: 'fincloud_auth_attempts_total',
  help: 'Authentication attempts by result',
  labelNames: ['result'],
  registers: [registry]
});

export const dbUp = new client.Gauge({
  name: 'fincloud_db_up',
  help: 'MariaDB connectivity status (1 = up, 0 = down)',
  registers: [registry]
});

export const storageUp = new client.Gauge({
  name: 'fincloud_storage_up',
  help: 'MinIO object storage connectivity status (1 = up, 0 = down)',
  registers: [registry]
});

/**
 * Resolves a low-cardinality route label.
 * Express exposes the matched route pattern after routing, so dynamic IDs
 * collapse into e.g. `/api/transactions/:id` instead of one label per ID.
 */
function resolveRouteLabel(req) {
  if (!req.route) return 'unmatched';

  const base = req.baseUrl || '';
  const path = req.route.path || '';
  const combined = `${base}${path}`;
  return combined.replace(/\/+/g, '/') || '/';
}

export function metricsMiddleware(req, res, next) {
  // Never count scrapes of the metrics endpoint itself.
  if (req.path === '/metrics') {
    next();
    return;
  }

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    const labels = {
      method: req.method,
      route: resolveRouteLabel(req),
      status: String(res.statusCode)
    };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, durationSeconds);
  });

  next();
}

export async function metricsHandler(req, res) {
  res.setHeader('Content-Type', registry.contentType);
  res.end(await registry.metrics());
}
