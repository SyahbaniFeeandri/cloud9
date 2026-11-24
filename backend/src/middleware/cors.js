const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8080',
  'https://localhost:8443'
];

export function parseOrigins(value) {
  return String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Builds the cors() options from a comma-separated allowlist.
 *
 * Requests without an Origin header (same-origin navigation, curl, server to
 * server, Prometheus) are always allowed. Browser cross-origin requests are
 * only allowed when their Origin is explicitly listed; otherwise the response
 * simply omits CORS headers so the browser blocks it.
 */
export function createCorsOptions(value = process.env.CORS_ORIGINS) {
  const allowed = parseOrigins(value);
  const origins = allowed.length > 0 ? allowed : DEFAULT_ORIGINS;

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      callback(null, origins.includes('*') || origins.includes(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400
  };
}
