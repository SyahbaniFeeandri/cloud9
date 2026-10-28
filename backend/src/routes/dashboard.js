import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

// GET /api/dashboard
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Overall Balance Calculation
    const [totals] = await pool.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
        COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense,
        COUNT(id) AS total_count
       FROM transactions 
       WHERE user_id = ?`,
      [userId]
    );

    const totalIncome = parseFloat(totals[0].total_income);
    const totalExpense = parseFloat(totals[0].total_expense);
    const currentBalance = totalIncome - totalExpense;

    // 2. Current Month Totals
    const [monthTotals] = await pool.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END), 0) AS monthly_income,
        COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0) AS monthly_expense,
        COUNT(id) AS monthly_count
       FROM transactions 
       WHERE user_id = ? 
         AND MONTH(transaction_date) = MONTH(CURRENT_DATE()) 
         AND YEAR(transaction_date) = YEAR(CURRENT_DATE())`,
      [userId]
    );

    // 3. Top Expense Category this month or overall
    const [topCategories] = await pool.query(
      `SELECT c.name, c.color, SUM(t.amount) as total_amount
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = ? AND t.transaction_type = 'expense'
       GROUP BY c.name, c.color
       ORDER BY total_amount DESC
       LIMIT 5`,
      [userId]
    );

    // 4. Five Recent Transactions
    const [recentTransactions] = await pool.query(
      `SELECT t.id, t.transaction_type as type, t.amount, t.description, t.transaction_date as date,
              c.name as category, c.icon as category_icon, c.color as category_color,
              r.object_url as receipt
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       LEFT JOIN receipts r ON r.transaction_id = t.id
       WHERE t.user_id = ?
       ORDER BY t.transaction_date DESC, t.id DESC
       LIMIT 5`,
      [userId]
    );

    return res.json({
      success: true,
      data: {
        currentBalance,
        totalIncome,
        totalExpense,
        monthlyIncome: parseFloat(monthTotals[0].monthly_income),
        monthlyExpense: parseFloat(monthTotals[0].monthly_expense),
        transactionCount: totals[0].total_count,
        topCategories,
        recentTransactions
      }
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

