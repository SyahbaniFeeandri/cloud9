import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAmount,
  normalizeDate,
  validateCreatePayload,
  mergeUpdatePayload,
  validateUpdatePayload,
  normalizePagination
} from '../src/utils/transactionValidation.js';

const validPayload = {
  type: 'expense',
  amount: 54321,
  category_id: 3,
  description: 'QA transaction',
  date: '2026-11-06'
};

test('Transactions - accepts a complete valid create payload', () => {
  const result = validateCreatePayload(validPayload);

  assert.equal(result.valid, true);
  assert.equal(result.value.type, 'expense');
  assert.equal(result.value.amount, 54321);
  assert.equal(result.value.date, '2026-11-06');
});

test('Transactions - accepts numeric strings and normalizes ISO datetimes', () => {
  const result = validateCreatePayload({
    ...validPayload,
    amount: '125000.50',
    date: '2026-11-06T10:30:00.000Z'
  });

  assert.equal(result.valid, true);
  assert.equal(result.value.amount, 125000.5);
  assert.equal(result.value.date, '2026-11-06');
});

test('Transactions - rejects missing or unknown type', () => {
  assert.equal(validateCreatePayload({ ...validPayload, type: undefined }).valid, false);
  assert.equal(validateCreatePayload({ ...validPayload, type: 'transfer' }).valid, false);
});

test('Transactions - rejects zero, negative, and non-numeric amounts', () => {
  for (const amount of [0, -1, -50000, 'abc', '', null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = validateCreatePayload({ ...validPayload, amount });
    assert.equal(result.valid, false, `amount ${String(amount)} should be rejected`);
  }
});

test('Transactions - requires a category id or category name', () => {
  const withoutCategory = { ...validPayload };
  delete withoutCategory.category_id;

  assert.equal(validateCreatePayload(withoutCategory).valid, false);
  assert.equal(validateCreatePayload({ ...withoutCategory, category: 'Food' }).valid, true);
});

test('Transactions - rejects invalid and impossible dates', () => {
  for (const date of ['', 'not-a-date', '2026-13-01', '2026-02-31', '2026/11/06', null, undefined]) {
    const result = validateCreatePayload({ ...validPayload, date });
    assert.equal(result.valid, false, `date ${String(date)} should be rejected`);
  }
});

test('Transactions - parses amounts and dates safely', () => {
  assert.equal(parseAmount('1500'), 1500);
  assert.equal(parseAmount(1500.75), 1500.75);
  assert.equal(parseAmount('not-a-number'), null);
  assert.equal(normalizeDate('2026-02-28'), '2026-02-28');
  assert.equal(normalizeDate('2026-02-29'), null);
  assert.equal(normalizeDate('2024-02-29'), '2024-02-29');
});

test('Transactions - partial update keeps existing values', () => {
  const existing = {
    transaction_type: 'income',
    amount: 200000,
    category_id: 1,
    description: 'Salary',
    transaction_date: '2026-11-01'
  };

  const merged = mergeUpdatePayload(existing, { description: 'Updated salary' });

  assert.equal(merged.type, 'income');
  assert.equal(merged.amount, 200000);
  assert.equal(merged.category_id, 1);
  assert.equal(merged.description, 'Updated salary');
  assert.equal(merged.date, '2026-11-01');
});

test('Transactions - partial update accepts a new amount and type', () => {
  const existing = {
    transaction_type: 'income',
    amount: 200000,
    category_id: 1,
    description: 'Salary',
    transaction_date: '2026-11-01'
  };

  const result = validateUpdatePayload(
    { type: 'expense', amount: 75000, category_id: 2 },
    existing
  );

  assert.equal(result.valid, true);
  assert.equal(result.value.type, 'expense');
  assert.equal(result.value.amount, 75000);
  assert.equal(result.value.category_id, 2);
});

test('Transactions - partial update rejects an invalid amount', () => {
  const existing = {
    transaction_type: 'income',
    amount: 200000,
    category_id: 1,
    description: 'Salary',
    transaction_date: '2026-11-01'
  };

  const result = validateUpdatePayload({ amount: -100 }, existing);
  assert.equal(result.valid, false);
});

test('Transactions - pagination is clamped to safe bounds', () => {
  assert.deepEqual(normalizePagination({}), { limit: 100, offset: 0 });
  assert.deepEqual(normalizePagination({ limit: '25', offset: '10' }), { limit: 25, offset: 10 });
  assert.deepEqual(normalizePagination({ limit: 0, offset: -5 }), { limit: 1, offset: 0 });
  assert.deepEqual(normalizePagination({ limit: 99999, offset: 'abc' }), { limit: 1000, offset: 0 });
  assert.deepEqual(normalizePagination({ limit: 'abc', offset: 'abc' }), { limit: 100, offset: 0 });
});
