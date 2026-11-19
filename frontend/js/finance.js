/**
 * FinCloud financial calculations.
 *
 * Pure functions with no DOM or network dependencies so they can be unit
 * tested with `node --test` and reused by the reports view.
 */

/**
 * Number of days covered by a report period (inclusive).
 * Falls back to 30 days for "all time" where no range is provided.
 */
export function calculatePeriodDays(startDate, endDate) {
  if (!startDate || !endDate) return 30;

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 30;

  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(diff, 1);
}

/**
 * Builds the report summary from category aggregates.
 * Keeps the same rounding rules previously used by the reports view.
 */
export function calculateReportData(incomeCategories = [], expenseCategories = [], periodDays = 30) {
  const totalIncome = incomeCategories.reduce(
    (sum, category) => sum + Number(category.total_amount || 0),
    0
  );
  const totalExpense = expenseCategories.reduce(
    (sum, category) => sum + Number(category.total_amount || 0),
    0
  );
  const incomeCount = incomeCategories.reduce(
    (sum, category) => sum + Number(category.transaction_count || 0),
    0
  );
  const expenseCount = expenseCategories.reduce(
    (sum, category) => sum + Number(category.transaction_count || 0),
    0
  );

  const netSavings = totalIncome - totalExpense;
  const savingsRatio = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;
  const avgDailyExpense = Math.round(totalExpense / Math.max(Number(periodDays) || 0, 1));

  const expenseRanks = expenseCategories
    .map((category) => ({
      category: category.name,
      type: 'expense',
      color: category.color,
      total: Number(category.total_amount || 0),
      count: Number(category.transaction_count || 0),
      percentage: totalExpense > 0
        ? Math.round((Number(category.total_amount || 0) / totalExpense) * 100)
        : 0
    }))
    .sort((a, b) => b.total - a.total);

  const incomeRanks = incomeCategories
    .map((category) => ({
      category: category.name,
      type: 'income',
      color: category.color,
      total: Number(category.total_amount || 0),
      count: Number(category.transaction_count || 0),
      percentage: totalIncome > 0
        ? Math.round((Number(category.total_amount || 0) / totalIncome) * 100)
        : 0
    }))
    .sort((a, b) => b.total - a.total);

  return {
    totalIncome,
    totalExpense,
    netSavings,
    savingsRatio,
    avgDailyExpense,
    incomeCount,
    expenseCount,
    expenseRanks,
    incomeRanks
  };
}

/**
 * Groups transactions by calendar month (`YYYY-MM`) and computes the
 * income, expense and net cashflow for each month.
 */
export function calculateMonthlyCashflow(transactions = []) {
  const buckets = new Map();

  for (const transaction of transactions) {
    const rawDate = String(transaction?.date || transaction?.transaction_date || '');
    if (!/^\d{4}-\d{2}/.test(rawDate)) continue;

    const month = rawDate.slice(0, 7);
    const amount = Number(transaction.amount) || 0;
    const type = transaction.type || transaction.transaction_type;

    if (!buckets.has(month)) {
      buckets.set(month, { month, income: 0, expense: 0, net: 0, count: 0 });
    }

    const bucket = buckets.get(month);
    if (type === 'income') bucket.income += amount;
    if (type === 'expense') bucket.expense += amount;
    bucket.count += 1;
    bucket.net = bucket.income - bucket.expense;
  }

  return [...buckets.values()].sort((a, b) => a.month.localeCompare(b.month));
}
