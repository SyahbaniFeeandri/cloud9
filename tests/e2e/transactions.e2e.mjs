/**
 * FinCloud end-to-end test.
 *
 * Covers the complete transaction flow:
 *   Login -> Input Transaksi -> Upload Struk -> Dashboard -> Laporan -> Hapus.
 *
 * Also verifies two-user ownership isolation, RBAC, 20 transaction variations,
 * and cleanup of every record created by the test.
 *
 * Usage:
 *   node tests/e2e/transactions.e2e.mjs
 *   FINCLOUD_BASE_URL=http://localhost:5000/api node tests/e2e/transactions.e2e.mjs
 */

const BASE = (process.env.FINCLOUD_BASE_URL || 'http://localhost:8080/api').replace(/\/+$/, '');
const RUN_ID = `E2E-${Date.now()}`;

let failures = 0;
const created = new Map(); // transaction id -> token used to create it

function check(name, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` - ${extra}` : ''}`);
  if (!ok) failures += 1;
}

async function json(path, options = {}) {
  const res = await fetch(BASE + path, options);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body };
}

function auth(token, extra = {}) {
  return { Authorization: `Bearer ${token}`, ...extra };
}

function jsonAuth(token, extra = {}) {
  return auth(token, { 'Content-Type': 'application/json', ...extra });
}

async function login(email, password) {
  const result = await json('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return result;
}

async function createTransaction(token, payload) {
  const result = await json('/transactions', {
    method: 'POST',
    headers: jsonAuth(token),
    body: JSON.stringify(payload)
  });

  const id = result.body?.transactionId || result.body?.transaction?.id || result.body?.id;
  if (id) created.set(String(id), token);
  return { ...result, id };
}

async function deleteTransaction(token, id) {
  const result = await json(`/transactions/${id}`, {
    method: 'DELETE',
    headers: auth(token)
  });
  if (result.res.ok) created.delete(String(id));
  return result;
}

async function uploadReceipt(token, id, buffer, filename, type) {
  const form = new FormData();
  form.append('receipt', new Blob([buffer], { type }), filename);

  const res = await fetch(`${BASE}/transactions/${id}/receipt`, {
    method: 'POST',
    headers: auth(token),
    body: form
  });
  const body = await res.json().catch(() => null);
  return { res, body };
}

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

async function cleanup() {
  for (const [id, token] of [...created.entries()]) {
    try {
      await deleteTransaction(token, id);
    } catch {
      // Best effort; the next run uses a fresh RUN_ID anyway.
    }
  }
}

(async () => {
  console.log(`FinCloud E2E against ${BASE}`);
  console.log(`Run id: ${RUN_ID}\n`);

  // 1. Health
  const health = await json('/health');
  check('health 200', health.res.status === 200, String(health.body?.status));
  check('health database connected', health.body?.database?.connected === true);
  check('health storage connected', health.body?.storage?.connected === true);

  // 2. Authentication
  const userLogin = await login('user@fincloud.local', 'password123');
  check('login user 200', userLogin.res.status === 200, String(userLogin.res.status));
  check('login returns token', typeof userLogin.body?.token === 'string' && userLogin.body.token.length > 20);
  check('login role USER', userLogin.body?.user?.role === 'USER', userLogin.body?.user?.role);
  const userToken = userLogin.body?.token;
  if (!userToken) throw new Error('Cannot continue without a user token');

  const adminLogin = await login('admin@fincloud.local', 'password123');
  check('login admin 200', adminLogin.res.status === 200, String(adminLogin.res.status));
  check('login admin role ADMIN', adminLogin.body?.user?.role === 'ADMIN', adminLogin.body?.user?.role);
  const adminToken = adminLogin.body?.token;
  if (!adminToken) throw new Error('Cannot continue without an admin token');

  const badLogin = await login('user@fincloud.local', 'wrong-password');
  check('invalid login 401', badLogin.res.status === 401, String(badLogin.res.status));

  const noToken = await json('/transactions');
  check('transactions without token 401', noToken.res.status === 401, String(noToken.res.status));

  const badToken = await json('/transactions', { headers: auth('not-a-real-token') });
  check('invalid token 401', badToken.res.status === 401, String(badToken.res.status));

  // 3. Reference data
  const categories = await json('/transactions/categories', { headers: auth(userToken) });
  check('categories 200', categories.res.status === 200, String(categories.body?.categories?.length));
  const allCategories = categories.body?.categories || [];
  const expenseCategories = allCategories.filter((category) => category.type === 'expense');
  const incomeCategories = allCategories.filter((category) => category.type === 'income');
  check('categories have income and expense', expenseCategories.length > 0 && incomeCategories.length > 0);

  const initialDashboard = await json('/dashboard', { headers: auth(userToken) });
  check('dashboard 200', initialDashboard.res.status === 200, String(initialDashboard.res.status));

  const initialList = await json('/transactions?limit=5', { headers: auth(userToken) });
  check('transactions list 200', initialList.res.status === 200);
  check('transactions list has total', typeof initialList.body?.total === 'number', String(initialList.body?.total));
  check('transactions list has summary', Boolean(initialList.body?.summary));

  // 4. Create transaction
  const today = new Date().toISOString().slice(0, 10);
  const main = await createTransaction(userToken, {
    type: 'expense',
    amount: 54321,
    category_id: expenseCategories[0].id,
    description: `${RUN_ID} main transaction`,
    date: today
  });
  check('create transaction 201', main.res.status === 201, String(main.res.status));
  check('create returns id', Boolean(main.id), String(main.id));
  if (!main.id) throw new Error('Cannot continue without a transaction id');

  const mainId = main.id;

  const fetched = await json(`/transactions/${mainId}`, { headers: auth(userToken) });
  check('get transaction 200', fetched.res.status === 200, String(fetched.res.status));
  check('get returns matching id', String(fetched.body?.transaction?.id) === String(mainId));

  // 5. Dashboard reflects the new transaction
  const dashboard = await json('/dashboard', { headers: auth(userToken) });
  check('dashboard 200 after create', dashboard.res.status === 200);
  const recent = dashboard.body?.data?.recentTransactions || [];
  check(
    'dashboard includes new transaction',
    recent.some((row) => String(row.id) === String(mainId))
  );

  // 6. Upload receipt and verify private object access
  const upload = await uploadReceipt(userToken, mainId, PNG, 'e2e-receipt.png', 'image/png');
  check('upload receipt 201', upload.res.status === 201, String(upload.res.status));
  const receiptUrl = upload.body?.receipt?.url;
  check('upload returns presigned URL', /X-Amz-Signature=/.test(receiptUrl || ''), (receiptUrl || '').split('?')[0]);

  if (receiptUrl) {
    const stored = await fetch(receiptUrl);
    check('presigned receipt 200', stored.status === 200, String(stored.status));
    check(
      'receipt content-type image/png',
      (stored.headers.get('content-type') || '').includes('image/png'),
      stored.headers.get('content-type') || ''
    );

    const anonymous = await fetch(receiptUrl.split('?')[0]);
    check('anonymous bucket access denied', anonymous.status === 403, String(anonymous.status));
  }

  const afterUpload = await json(`/transactions/${mainId}`, { headers: auth(userToken) });
  check(
    'transaction exposes presigned receipt',
    /X-Amz-Signature=/.test(afterUpload.body?.transaction?.receipt || '')
  );

  const listAfterUpload = await json('/transactions?limit=100', { headers: auth(userToken) });
  const listRow = (listAfterUpload.body?.transactions || [])
    .find((row) => String(row.id) === String(mainId));
  check('list exposes presigned receipt', /X-Amz-Signature=/.test(listRow?.receipt || ''));

  const freshUrl = await json(`/transactions/${mainId}/receipt-url`, { headers: auth(userToken) });
  check('receipt-url endpoint 200', freshUrl.res.status === 200, String(freshUrl.res.status));
  check('receipt-url returns signature', /X-Amz-Signature=/.test(freshUrl.body?.url || ''));

  // 7. Update transaction
  const updated = await json(`/transactions/${mainId}`, {
    method: 'PUT',
    headers: jsonAuth(userToken),
    body: JSON.stringify({ description: `${RUN_ID} updated`, amount: 65432 })
  });
  check('update transaction 200', updated.res.status === 200, String(updated.res.status));

  const afterUpdate = await json(`/transactions/${mainId}`, { headers: auth(userToken) });
  check(
    'update persisted description',
    afterUpdate.body?.transaction?.description === `${RUN_ID} updated`,
    afterUpdate.body?.transaction?.description
  );
  check(
    'update persisted amount',
    Number(afterUpdate.body?.transaction?.amount) === 65432,
    String(afterUpdate.body?.transaction?.amount)
  );

  // 8. Reports
  const categoryReport = await json('/reports/category?type=expense', { headers: auth(userToken) });
  check('reports category 200', categoryReport.res.status === 200, String(categoryReport.res.status));

  const monthlyReport = await json(
    `/reports/monthly?year=${new Date().getFullYear()}`,
    { headers: auth(userToken) }
  );
  check('reports monthly 200', monthlyReport.res.status === 200, String(monthlyReport.res.status));
  check('reports monthly returns stats', Array.isArray(monthlyReport.body?.monthlyStats));

  // 9. Delete receipt then transaction
  const deletedReceipt = await json(`/transactions/${mainId}/receipt`, {
    method: 'DELETE',
    headers: auth(userToken)
  });
  check('delete receipt 200', deletedReceipt.res.status === 200, String(deletedReceipt.res.status));

  if (receiptUrl) {
    const afterReceiptDelete = await fetch(receiptUrl);
    check(
      'deleted receipt no longer served',
      [403, 404].includes(afterReceiptDelete.status),
      String(afterReceiptDelete.status)
    );
  }

  const deleted = await deleteTransaction(userToken, mainId);
  check('delete transaction 200', deleted.res.status === 200, String(deleted.res.status));

  const afterDelete = await json(`/transactions/${mainId}`, { headers: auth(userToken) });
  check('deleted transaction 404', afterDelete.res.status === 404, String(afterDelete.res.status));

  // 10. Two-user ownership isolation
  const adminTx = await createTransaction(adminToken, {
    type: 'income',
    amount: 777777,
    category_id: incomeCategories[0].id,
    description: `${RUN_ID} admin transaction`,
    date: today
  });
  check('admin create transaction 201', adminTx.res.status === 201, String(adminTx.res.status));
  if (adminTx.id) {
    const userReadsAdmin = await json(`/transactions/${adminTx.id}`, { headers: auth(userToken) });
    check('user cannot read admin transaction', userReadsAdmin.res.status === 404, String(userReadsAdmin.res.status));

    const userUpdatesAdmin = await json(`/transactions/${adminTx.id}`, {
      method: 'PUT',
      headers: jsonAuth(userToken),
      body: JSON.stringify({ amount: 1 })
    });
    check('user cannot update admin transaction', userUpdatesAdmin.res.status === 404, String(userUpdatesAdmin.res.status));

    const userDeletesAdmin = await json(`/transactions/${adminTx.id}`, {
      method: 'DELETE',
      headers: auth(userToken)
    });
    check('user cannot delete admin transaction', userDeletesAdmin.res.status === 404, String(userDeletesAdmin.res.status));

    const adminDeletes = await deleteTransaction(adminToken, adminTx.id);
    check('admin deletes own transaction', adminDeletes.res.status === 200, String(adminDeletes.res.status));
  }

  // 11. Twenty transaction variations for the functional test checklist
  const bulkTag = `${RUN_ID}-BULK`;
  let expectedIncome = 0;
  let expectedExpense = 0;
  let bulkCreated = 0;

  for (let index = 0; index < 20; index += 1) {
    const type = index % 2 === 0 ? 'income' : 'expense';
    const pool = type === 'income' ? incomeCategories : expenseCategories;
    const category = pool[index % pool.length];
    const amount = 10000 + index * 1375;
    const date = new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const row = await createTransaction(userToken, {
      type,
      amount,
      category_id: category.id,
      description: `${bulkTag} row ${index}`,
      date
    });

    if (row.res.status === 201) bulkCreated += 1;
    if (type === 'income') expectedIncome += amount;
    else expectedExpense += amount;
  }

  check('bulk created 20 transactions', bulkCreated === 20, String(bulkCreated));

  const bulkList = await json(
    `/transactions?search=${encodeURIComponent(bulkTag)}&limit=100`,
    { headers: auth(userToken) }
  );
  check('bulk list total 20', bulkList.body?.total === 20, String(bulkList.body?.total));
  check(
    'bulk summary income matches',
    Math.abs(Number(bulkList.body?.summary?.totalIncome) - expectedIncome) < 0.01,
    `${bulkList.body?.summary?.totalIncome} vs ${expectedIncome}`
  );
  check(
    'bulk summary expense matches',
    Math.abs(Number(bulkList.body?.summary?.totalExpense) - expectedExpense) < 0.01,
    `${bulkList.body?.summary?.totalExpense} vs ${expectedExpense}`
  );

  for (const row of bulkList.body?.transactions || []) {
    const result = await deleteTransaction(userToken, row.id);
    check(`bulk delete ${row.id}`, result.res.status === 200, String(result.res.status));
  }

  // 12. Profile roundtrip
  const profile = await json('/auth/profile', { headers: auth(userToken) });
  check('get profile 200', profile.res.status === 200, String(profile.res.status));
  const originalName = profile.body?.user?.name;
  const originalEmail = profile.body?.user?.email;

  const updatedProfile = await json('/auth/profile', {
    method: 'PUT',
    headers: jsonAuth(userToken),
    body: JSON.stringify({ name: 'FinCloud QA', email: originalEmail })
  });
  check('update profile 200', updatedProfile.res.status === 200, String(updatedProfile.res.status));
  check('profile name changed', updatedProfile.body?.user?.name === 'FinCloud QA', updatedProfile.body?.user?.name);

  await json('/auth/profile', {
    method: 'PUT',
    headers: jsonAuth(userToken),
    body: JSON.stringify({ name: originalName, email: originalEmail })
  });

  // 13. RBAC
  const adminUsers = await json('/admin/users', { headers: auth(adminToken) });
  check('admin can read users', adminUsers.res.status === 200, String(adminUsers.res.status));

  const userAdmin = await json('/admin/users', { headers: auth(userToken) });
  check('user blocked from admin 403', userAdmin.res.status === 403, String(userAdmin.res.status));

  const anonymousAdmin = await json('/admin/users');
  check('anonymous blocked from admin 401', anonymousAdmin.res.status === 401, String(anonymousAdmin.res.status));

  // 14. Logout
  const logout = await json('/auth/logout', { method: 'POST', headers: auth(userToken) });
  check('logout 200', logout.res.status === 200, String(logout.res.status));

  console.log(`\n${failures === 0 ? 'ALL E2E CHECKS PASSED' : `${failures} E2E CHECK(S) FAILED`}`);
  process.exitCode = failures === 0 ? 0 : 1;
})()
  .catch((error) => {
    console.error('E2E script crashed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
  });
