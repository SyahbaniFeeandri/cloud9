import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

// GET /api/reports/monthly - Monthly Summary and Cashflow
router.get('/monthly', async (req, res) => {
  try {
    const userId = req.user.id;
    const { year = new Date().getFullYear() } = req.query;

    const [monthlyStats] = await pool.query(
      `SELECT 
        MONTH(transaction_date) as month,
        SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END) AS income,
        SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END) AS expense,
        COUNT(id) AS count
       FROM transactions
       WHERE user_id = ? AND YEAR(transaction_date) = ?
       GROUP BY MONTH(transaction_date)
       ORDER BY month ASC`,
      [userId, year]
    );

    return res.json({
      success: true,
      year: parseInt(year, 10),
      monthlyStats
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/reports/category - Expense breakdown by category
router.get('/category', async (req, res) => {
  try {
    const userId = req.user.id;
    const { type = 'expense', startDate, endDate } = req.query;

    let query = `
      SELECT c.id, c.name, c.color, c.icon,
             SUM(t.amount) as total_amount,
             COUNT(t.id) as transaction_count
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND t.transaction_type = ?
    `;
    const params = [userId, type];

    if (startDate) {
      query += ` AND t.transaction_date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND t.transaction_date <= ?`;
      params.push(endDate);
    }

    query += ` GROUP BY c.id, c.name, c.color, c.icon ORDER BY total_amount DESC`;

    const [categories] = await pool.query(query, params);

    return res.json({
      success: true,
      type,
      categories
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

