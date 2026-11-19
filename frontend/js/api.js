/**
 * FinCloud HTTP client.
 * Single place for JWT headers, JSON parsing, timeouts and API errors.
 */

import {
  API_BASE_URL,
  API_ORIGIN,
  STORAGE_KEYS,
  REQUEST_TIMEOUT,
  UPLOAD_TIMEOUT
} from './config.js';

export class ApiError extends Error {
  constructor(message, status = 0, payload = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

/* ------------------------------------------------------------------ */
/* Token helpers                                                       */
/* ------------------------------------------------------------------ */

export function getToken() {
  return localStorage.getItem(STORAGE_KEYS.TOKEN);
}

export function setToken(token) {
  if (token) localStorage.setItem(STORAGE_KEYS.TOKEN, token);
}

export function clearToken() {
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
}

export function decodeJwt(token) {
  if (!token || typeof token !== 'string') return null;

  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch (error) {
    return null;
  }
}

export function isTokenExpired(token, leewaySeconds = 5) {
  const payload = decodeJwt(token);
  if (!payload || !payload.exp) return true;
  return payload.exp * 1000 <= Date.now() + leewaySeconds * 1000;
}

/* ------------------------------------------------------------------ */
/* URL helpers                                                         */
/* ------------------------------------------------------------------ */

export function buildQuery(params = {}) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.append(key, value);
  });

  const query = search.toString();
  return query ? `?${query}` : '';
}

/**
 * Turns a stored relative receipt path (e.g. /storage/bucket/key) into a
 * URL the browser can load in both local-dev and Docker deployments.
 */
export function resolveReceiptUrl(url) {
  if (!url) return null;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

/* ------------------------------------------------------------------ */
/* Core request                                                        */
/* ------------------------------------------------------------------ */

async function request(path, options = {}) {
  const {
    method = 'GET',
    body,
    auth = true,
    timeout = REQUEST_TIMEOUT,
    isFormData = false,
    silent401 = false
  } = options;

  const token = getToken();
  const headers = {};

  if (body !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (auth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timer);

    if (error.name === 'AbortError') {
      throw new ApiError('Permintaan melebihi batas waktu. Silakan coba lagi.', 0, error);
    }
    throw new ApiError(
      'Tidak dapat terhubung ke server FinCloud. Pastikan backend berjalan.',
      0,
      error
    );
  }
  clearTimeout(timer);

  const contentType = response.headers.get('content-type') || '';
  let data = null;

  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => null);
  } else {
    data = await response.text().catch(() => '');
  }

  if (!response.ok) {
    // 401 means the session is missing/expired. Only notify the app when the
    // request actually carried a token, so a failed login is not treated as
    // an expired session.
    if (response.status === 401 && auth && token && !silent401) {
      window.dispatchEvent(
        new CustomEvent('fincloud:unauthorized', {
          detail: {
            status: response.status,
            message: data?.message || 'Invalid or expired token'
          }
        })
      );
    }

    const message =
      (data && typeof data === 'object' && data.message) ||
      (typeof data === 'string' && data) ||
      `Permintaan gagal (HTTP ${response.status})`;

    throw new ApiError(message, response.status, data);
  }

  return data;
}

/* ------------------------------------------------------------------ */
/* API surface                                                         */
/* ------------------------------------------------------------------ */

export const api = {
  auth: {
    login: (email, password) =>
      request('/auth/login', { method: 'POST', body: { email, password }, auth: false }),

    register: (name, email, password) =>
      request('/auth/register', {
        method: 'POST',
        body: { name, email, password },
        auth: false
      }),

    logout: () => request('/auth/logout', { method: 'POST', silent401: true }),

    profile: () => request('/auth/profile'),

    updateProfile: (payload) =>
      request('/auth/profile', { method: 'PUT', body: payload })
  },

  transactions: {
    list: (params = {}) => request(`/transactions${buildQuery(params)}`),

    get: (id) => request(`/transactions/${encodeURIComponent(id)}`),

    create: (payload) => request('/transactions', { method: 'POST', body: payload }),

    update: (id, payload) =>
      request(`/transactions/${encodeURIComponent(id)}`, { method: 'PUT', body: payload }),

    remove: (id) =>
      request(`/transactions/${encodeURIComponent(id)}`, { method: 'DELETE' }),

    categories: () => request('/transactions/categories'),

    uploadReceipt: (id, file) => {
      const formData = new FormData();
      formData.append('receipt', file);

      return request(`/transactions/${encodeURIComponent(id)}/receipt`, {
        method: 'POST',
        body: formData,
        isFormData: true,
        timeout: UPLOAD_TIMEOUT
      });
    },

    deleteReceipt: (id) =>
      request(`/transactions/${encodeURIComponent(id)}/receipt`, { method: 'DELETE' }),

    receiptUrl: (id) =>
      request(`/transactions/${encodeURIComponent(id)}/receipt-url`)
  },

  dashboard: {
    get: () => request('/dashboard')
  },

  reports: {
    monthly: (year) => request(`/reports/monthly${buildQuery({ year })}`),

    category: (params = {}) => request(`/reports/category${buildQuery(params)}`)
  },

  admin: {
    users: () => request('/admin/users'),
    auditLogs: (params = {}) => request(`/admin/audit-logs${buildQuery(params)}`),
    systemStatus: () => request('/admin/system-status')
  },

  health: {
    check: () => request('/health', { auth: false })
  }
};
