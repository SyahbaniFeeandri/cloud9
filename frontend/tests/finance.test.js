import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePeriodDays,
  calculateReportData,
  calculateMonthlyCashflow
} from '../js/finance.js';

const income = [
  { name: 'Salary', color: '#10b981', total_amount: 10000000, transaction_count: 1 },
  { name: 'Business', color: '#06b6d4', total_amount: 2500000, transaction_count: 2 }
];

const expense = [
  { name: 'Food', color: '#ef4444', total_amount: 3000000, transaction_count: 4 },
  { name: 'Transport', color: '#f59e0b', total_amount: 1000000, transaction_count: 3 }
];

test('Finance - surplus report calculates net savings and ratio', () => {
  const result = calculateReportData(income, expense, 30);

  assert.equal(result.totalIncome, 12500000);
  assert.equal(result.totalExpense, 4000000);
  assert.equal(result.netSavings, 8500000);
  assert.equal(result.savingsRatio, 68);
  assert.equal(result.incomeCount, 3);
  assert.equal(result.expenseCount, 7);
  assert.equal(result.avgDailyExpense, 133333);
});

test('Finance - deficit report produces negative savings', () => {
  const result = calculateReportData(
    [{ name: 'Salary', total_amount: 1000000, transaction_count: 1 }],
    [{ name: 'Rent', total_amount: 1500000, transaction_count: 1 }],
    30
  );

  assert.equal(result.netSavings, -500000);
  assert.equal(result.savingsRatio, -50);
  assert.equal(result.avgDailyExpense, 50000);
});

test('Finance - zero income avoids division by zero', () => {
  const result = calculateReportData([], expense, 30);

  assert.equal(result.totalIncome, 0);
  assert.equal(result.savingsRatio, 0);
  assert.equal(result.netSavings, -4000000);
});

test('Finance - average daily expense respects the period length', () => {
  const result = calculateReportData([], [{ name: 'Food', total_amount: 900000, transaction_count: 1 }], 9);
  assert.equal(result.avgDailyExpense, 100000);

  const oneDay = calculateReportData([], [{ name: 'Food', total_amount: 900000, transaction_count: 1 }], 1);
  assert.equal(oneDay.avgDailyExpense, 900000);
});

test('Finance - category ranking is sorted and percentages use rounded shares', () => {
  const result = calculateReportData(income, expense, 30);

  assert.deepEqual(result.expenseRanks.map((row) => row.category), ['Food', 'Transport']);
  assert.equal(result.expenseRanks[0].percentage, 75);
  assert.equal(result.expenseRanks[1].percentage, 25);
  assert.deepEqual(result.incomeRanks.map((row) => row.category), ['Salary', 'Business']);
  assert.equal(result.incomeRanks[0].percentage, 80);
  assert.equal(result.incomeRanks[1].percentage, 20);
});

test('Finance - empty categories produce a zeroed report', () => {
  const result = calculateReportData([], [], 30);

  assert.equal(result.totalIncome, 0);
  assert.equal(result.totalExpense, 0);
  assert.equal(result.netSavings, 0);
  assert.equal(result.savingsRatio, 0);
  assert.equal(result.avgDailyExpense, 0);
  assert.deepEqual(result.expenseRanks, []);
  assert.deepEqual(result.incomeRanks, []);
});

test('Finance - period days are inclusive and fall back to 30 for all time', () => {
  assert.equal(calculatePeriodDays('2026-11-01', '2026-11-30'), 30);
  assert.equal(calculatePeriodDays('2026-01-01', '2026-01-01'), 1);
  assert.equal(calculatePeriodDays(undefined, undefined), 30);
  assert.equal(calculatePeriodDays('not-a-date', '2026-01-01'), 30);
});

test('Finance - monthly cashflow groups income and expense per month', () => {
  const rows = calculateMonthlyCashflow([
    { type: 'income', amount: 5000000, date: '2026-01-05' },
    { type: 'expense', amount: 1500000, date: '2026-01-20' },
    { type: 'income', amount: 6000000, date: '2026-02-01' },
    { type: 'expense', amount: 2000000, date: '2026-02-11' },
    { type: 'expense', amount: 500000, date: '2026-02-12' }
  ]);

  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { month: '2026-01', income: 5000000, expense: 1500000, net: 3500000, count: 2 });
  assert.deepEqual(rows[1], { month: '2026-02', income: 6000000, expense: 2500000, net: 3500000, count: 3 });
});

test('Finance - monthly cashflow ignores invalid dates and empty input', () => {
  assert.deepEqual(calculateMonthlyCashflow([]), []);
  assert.deepEqual(
    calculateMonthlyCashflow([
      { type: 'income', amount: 100, date: 'not-a-date' },
      { type: 'expense', amount: 50 }
    ]),
    []
  );
});
