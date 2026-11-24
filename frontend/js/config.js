/**
 * FinCloud runtime configuration.
 *
 * Local dev (npx serve on :3000) talks directly to the Express API on :5000.
 * Docker / Nginx deployments use the same-origin `/api` proxy. Receipt images
 * are loaded from short-lived presigned MinIO URLs returned by the API.
 * The value can always be overridden before app.js loads:
 *   <script>window.FINCLOUD_API_BASE = 'https://api.example.com/api'</script>
 */

const LOCAL_DEV_PORTS = ['3000', '5173', '5500', '8000', '4173'];

function detectApiBase() {
  if (window.FINCLOUD_API_BASE) return window.FINCLOUD_API_BASE;

  const saved = localStorage.getItem('fincloud_api_base');
  if (saved) return saved;

  const port = window.location.port;
  if (LOCAL_DEV_PORTS.includes(port)) {
    // Use the current hostname so LAN/mobile testing works too.
    const host = window.location.hostname || 'localhost';
    return `http://${host}:5000/api`;
  }

  // Docker/Nginx: same-origin reverse proxy.
  return '/api';
}

export const API_BASE_URL = detectApiBase().replace(/\/+$/, '');

export const API_ORIGIN = API_BASE_URL.startsWith('http')
  ? new URL(API_BASE_URL).origin
  : window.location.origin;

export const STORAGE_KEYS = {
  TOKEN: 'fincloud_token',
  USER: 'fincloud_current_user',
  THEME: 'fincloud_theme'
};

export const REQUEST_TIMEOUT = 20000;
export const UPLOAD_TIMEOUT = 60000;
