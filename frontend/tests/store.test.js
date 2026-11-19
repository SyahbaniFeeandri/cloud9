import test from 'node:test';
import assert from 'node:assert/strict';

/* ------------------------------------------------------------------ */
/* Browser stubs                                                       */
/* ------------------------------------------------------------------ */

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key)
};

let unauthorizedEvents = 0;
globalThis.window = {
  location: { port: '3000', origin: 'http://localhost:3000' },
  addEventListener: () => {},
  dispatchEvent: (event) => {
    if (event.type === 'fincloud:unauthorized') unauthorizedEvents += 1;
  }
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, options) {
    this.type = type;
    this.detail = options?.detail;
  }
};

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

const token = `${base64url({ alg: 'HS256' })}.${base64url({
  id: 1,
  email: 'user@fincloud.local',
  role: 'USER',
  exp: Math.floor(Date.now() / 1000) + 3600
})}.signature`;

const responses = {
  '/auth/login': {
    success: true,
    token,
    user: { id: 1, name: 'Andi FinCloud', email: 'user@fincloud.local', role: 'USER' }
  },
  '/transactions?limit=8&offset=0': {
    success: true,
    count: 1,
    total: 12,
    summary: { totalIncome: 15000000, totalExpense: 3200000 },
    transactions: [
      {
        id: 1,
        type: 'income',
        amount: '15000000.00',
        category: 'Salary',
        description: 'Gaji',
        date: '2026-11-01',
        receipt: '/storage/fincloud-receipts/receipts/1/a.jpg',
        receiptName: 'a.jpg'
      }
    ]
  },
  '/dashboard': {
    success: true,
    data: {
      currentBalance: 11800000,
      totalIncome: 15000000,
      totalExpense: 3200000,
      monthlyIncome: 15000000,
      monthlyExpense: 3200000,
      transactionCount: 1,
      topCategories: [{ name: 'Housing', color: '#eab308', total_amount: '3200000.00' }],
      recentTransactions: [
        {
          id: 1,
          type: 'income',
          amount: '15000000.00',
          category: 'Salary',
          description: 'Gaji',
          date: '2026-11-01',
          receipt: null
        }
      ]
    }
  }
};

let rejectNextRequest = false;

globalThis.fetch = async (url) => {
  const path = url.replace('http://localhost:5000/api', '');

  if (rejectNextRequest) {
    rejectNextRequest = false;
    return {
      ok: false,
      status: 401,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: false, message: 'Invalid or expired token' })
    };
  }

  const body = responses[path];
  if (!body) {
    return {
      ok: false,
      status: 404,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: false, message: 'Not found' })
    };
  }

  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => body
  };
};

const { FinStore } = await import('../js/store.js');
const { resolveReceiptUrl } = await import('../js/api.js');

test('Store - login persists the token and user', async () => {
  const user = await FinStore.login('user@fincloud.local', 'password123');

  assert.equal(user.name, 'Andi FinCloud');
  assert.equal(FinStore.isAuthenticated(), true);
  assert.ok(localStorage.getItem('fincloud_token'));
});

test('Store - transactions are normalized for the views', async () => {
  const rows = await FinStore.loadTransactions({ limit: 8, offset: 0 });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].amount, 15000000);
  assert.equal(rows[0].date, '2026-11-01');
  assert.equal(rows[0].receiptName, 'a.jpg');
  assert.equal(FinStore.getTransactionTotal(), 12);
  assert.equal(FinStore.getTransactionSummary().totalExpense, 3200000);
  assert.equal(
    rows[0].receipt,
    'http://localhost:5000/storage/fincloud-receipts/receipts/1/a.jpg'
  );
});

test('Store - dashboard numbers are converted to numbers', async () => {
  const dashboard = await FinStore.loadDashboard();

  assert.equal(dashboard.currentBalance, 11800000);
  assert.equal(dashboard.topCategories[0].total_amount, 3200000);
  assert.equal(dashboard.recentTransactions[0].amount, 15000000);
});

test('Store - resolveReceiptUrl keeps absolute URLs and prefixes relative ones', () => {
  assert.equal(
    resolveReceiptUrl('/storage/x.jpg'),
    'http://localhost:5000/storage/x.jpg'
  );
  assert.equal(
    resolveReceiptUrl('https://cdn.example.com/x.jpg'),
    'https://cdn.example.com/x.jpg'
  );
  assert.equal(resolveReceiptUrl(null), null);
});

test('Store - a 401 dispatches the unauthorized event', async () => {
  rejectNextRequest = true;
  const before = unauthorizedEvents;

  await assert.rejects(() => FinStore.verifySession());
  assert.equal(unauthorizedEvents, before + 1);
});
