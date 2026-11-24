/**
 * Validation and normalization helpers for the transaction endpoints.
 *
 * These are pure functions so they can be unit tested without a database.
 */

export const TRANSACTION_TYPES = ['income', 'expense'];

const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Parses a numeric amount from a number or numeric string.
 * Returns `null` when the value is not a finite number.
 */
export function parseAmount(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

/**
 * Normalizes a date to `YYYY-MM-DD` and rejects impossible calendar dates
 * such as `2026-02-31`.
 */
export function normalizeDate(value) {
  if (typeof value !== 'string') return null;

  const match = value.match(DATE_PREFIX);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;

  const isSameDay =
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() + 1 === Number(month) &&
    date.getUTCDate() === Number(day);

  return isSameDay ? `${year}-${month}-${day}` : null;
}

export function isValidTransactionType(value) {
  return TRANSACTION_TYPES.includes(value);
}

/**
 * Validates a create-transaction payload.
 * Returns `{ valid, message, value }` where `value` is the normalized payload.
 */
export function validateCreatePayload(payload = {}) {
  const { type, amount, category, category_id, date } = payload;

  if (!isValidTransactionType(type)) {
    return { valid: false, message: 'Type must be either "income" or "expense"' };
  }

  const parsedAmount = parseAmount(amount);
  if (parsedAmount === null || parsedAmount <= 0) {
    return { valid: false, message: 'Amount must be a positive number' };
  }

  if (!category && !category_id) {
    return { valid: false, message: 'Category is required' };
  }

  const normalizedDate = normalizeDate(date);
  if (!normalizedDate) {
    return { valid: false, message: 'Date must be a valid date (YYYY-MM-DD)' };
  }

  return {
    valid: true,
    value: {
      ...payload,
      type,
      amount: parsedAmount,
      date: normalizedDate
    }
  };
}

/**
 * Merges a partial update with the existing transaction row.
 * Mirrors the previous route behavior: omitted fields keep their old value.
 */
export function mergeUpdatePayload(existing = {}, input = {}) {
  return {
    type: input.type !== undefined ? input.type : (existing.transaction_type || existing.type),
    amount: input.amount !== undefined ? input.amount : existing.amount,
    category: input.category,
    category_id: input.category_id !== undefined ? input.category_id : existing.category_id,
    description: input.description !== undefined ? input.description : existing.description,
    date: input.date !== undefined
      ? input.date
      : (existing.transaction_date || existing.date)
  };
}

/**
 * Validates a partial update after merging it with the existing row.
 */
export function validateUpdatePayload(payload = {}, existing = {}) {
  const merged = mergeUpdatePayload(existing, payload);
  const validation = validateCreatePayload(merged);

  if (!validation.valid) return validation;
  return { valid: true, value: merged };
}

/**
 * Clamps pagination values to safe bounds.
 */
export function normalizePagination({ limit = 100, offset = 0 } = {}) {
  const parsedLimit = parseInt(limit, 10);
  const parsedOffset = parseInt(offset, 10);

  return {
    limit: Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 100, 1), 1000),
    offset: Math.max(Number.isFinite(parsedOffset) ? parsedOffset : 0, 0)
  };
}
