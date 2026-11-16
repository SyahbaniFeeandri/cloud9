import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
router.use(authenticateToken);

// GET /api/categories
router.get('/categories', async (req, res) => {
  try {
    const [categories] = await pool.query('SELECT * FROM categories ORDER BY type ASC, name ASC');
    return res.json({ success: true, categories });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/transactions - with filtering and search
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, category, search, startDate, endDate, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT t.id, t.user_id, t.transaction_type as type, t.amount, t.description,
             t.transaction_date as date, t.created_at as createdAt,
             c.id as category_id, c.name as category, c.icon as category_icon, c.color as category_color,
             r.id as receipt_id, r.object_url as receipt, r.filename as receiptName
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      LEFT JOIN receipts r ON r.transaction_id = t.id
      WHERE t.user_id = ?
    `;
    const params = [userId];

    if (type && ['income', 'expense'].includes(type)) {
      query += ` AND t.transaction_type = ?`;
      params.push(type);
    }

    if (category) {
      query += ` AND c.name = ?`;
      params.push(category);
    }

    if (search) {
      query += ` AND (t.description LIKE ? OR c.name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (startDate) {
      query += ` AND t.transaction_date >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND t.transaction_date <= ?`;
      params.push(endDate);
    }

    query += ` ORDER BY t.transaction_date DESC, t.id DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const [transactions] = await pool.query(query, params);

    return res.json({
      success: true,
      count: transactions.length,
      transactions
    });
  } catch (error) {
    console.error('Fetch transactions error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/transactions/:id
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const [rows] = await pool.query(
      `SELECT t.id, t.user_id, t.transaction_type as type, t.amount, t.description,
              t.transaction_date as date, t.created_at as createdAt,
              c.id as category_id, c.name as category, c.icon as category_icon, c.color as category_color,
              r.id as receipt_id, r.object_url as receipt, r.filename as receiptName
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       LEFT JOIN receipts r ON r.transaction_id = t.id
       WHERE t.id = ? AND t.user_id = ?`,
      [id, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    return res.json({ success: true, transaction: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/transactions
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, amount, category, category_id, description, date, receiptUrl, receiptName } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress;

    if (!type || !amount || (!category && !category_id) || !date) {
      return res.status(400).json({
        success: false,
        message: 'Type, amount, category, and date are required'
      });
    }

    // Resolve category_id if name is given
    let finalCategoryId = category_id;
    if (!finalCategoryId) {
      const [cats] = await pool.query(
        'SELECT id FROM categories WHERE name = ? AND type = ? LIMIT 1',
        [category, type]
      );
      if (cats.length === 0) {
        return res.status(400).json({ success: false, message: `Category "${category}" not found for type "${type}"` });
      }
      finalCategoryId = cats[0].id;
    }

    const [result] = await pool.query(
      `INSERT INTO transactions (user_id, category_id, transaction_type, amount, description, transaction_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, finalCategoryId, type, amount, description || '', date]
    );

    const transactionId = result.insertId;

    // Attach receipt if provided
    if (receiptUrl) {
      await pool.query(
        `INSERT INTO receipts (transaction_id, object_url, object_key, filename, file_type)
         VALUES (?, ?, ?, ?, ?)`,
        [transactionId, receiptUrl, `receipts/${transactionId}`, receiptName || 'receipt.jpg', 'image/jpeg']
      );
    }

    await logAudit({
      userId,
      action: 'TRANSACTION_CREATE',
      entity: 'transactions',
      entityId: transactionId,
      details: `Created ${type} of amount Rp${amount}`,
      ipAddress: clientIp
    });

    return res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      transactionId
    });
  } catch (error) {
    console.error('Create transaction error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/transactions/:id
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { type, amount, category, category_id, description, date } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress;

    const [existing] = await pool.query('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [id, userId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaction not found or unauthorized' });
    }

    let finalCategoryId = category_id || existing[0].category_id;
    if (category) {
      const [cats] = await pool.query(
        'SELECT id FROM categories WHERE name = ? AND type = ? LIMIT 1',
        [category, type || existing[0].transaction_type]
      );
      if (cats.length > 0) finalCategoryId = cats[0].id;
    }

    await pool.query(
      `UPDATE transactions 
       SET transaction_type = ?, amount = ?, category_id = ?, description = ?, transaction_date = ?
       WHERE id = ? AND user_id = ?`,
      [
        type || existing[0].transaction_type,
        amount || existing[0].amount,
        finalCategoryId,
        description !== undefined ? description : existing[0].description,
        date || existing[0].transaction_date,
        id,
        userId
      ]
    );

    await logAudit({
      userId,
      action: 'TRANSACTION_UPDATE',
      entity: 'transactions',
      entityId: id,
      details: `Updated transaction ID ${id}`,
      ipAddress: clientIp
    });

    return res.json({ success: true, message: 'Transaction updated successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const clientIp = req.ip || req.socket.remoteAddress;

    const [existing] = await pool.query('SELECT id, amount, transaction_type FROM transactions WHERE id = ? AND user_id = ?', [id, userId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaction not found or unauthorized' });
    }

    await pool.query('DELETE FROM transactions WHERE id = ? AND user_id = ?', [id, userId]);

    await logAudit({
      userId,
      action: 'TRANSACTION_DELETE',
      entity: 'transactions',
      entityId: id,
      details: `Deleted ${existing[0].transaction_type} of Rp${existing[0].amount}`,
      ipAddress: clientIp
    });

    return res.json({ success: true, message: 'Transaction deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

