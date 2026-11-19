import { Router } from 'express';
import multer from 'multer';
import { pool } from '../config/db.js';
import {
  transactionsCreatedTotal,
  receiptUploadsTotal,
  receiptUploadBytesTotal
} from '../config/metrics.js';
import {
  ensureBucket,
  uploadObject,
  deleteObject,
  presignObject,
  buildReceiptUrl,
  storageConfig
} from '../config/storage.js';
import { authenticateToken } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';
import {
  validateCreatePayload,
  validateUpdatePayload,
  normalizePagination
} from '../utils/transactionValidation.js';

const router = Router();
router.use(authenticateToken);

const ALLOWED_RECEIPT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!ALLOWED_RECEIPT_TYPES.has(file.mimetype)) {
      callback(new Error('Receipt must be a JPG, PNG, WEBP, or PDF file'));
      return;
    }
    callback(null, true);
  }
});

// Convert Multer errors (size/type) into consistent JSON responses.
function receiptUpload(req, res, next) {
  upload.single('receipt')(req, res, (error) => {
    if (error) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'Receipt file is too large (max 10 MB)'
        : error.message;
      return res.status(400).json({ success: false, message });
    }
    next();
  });
}

async function attachReceiptUrl(row, req = null) {
  if (!row) return row;
  const { receiptKey, receiptUrl, ...rest } = row;
  const receipt = receiptKey ? await presignObject(receiptKey, undefined, req) : null;

  return {
    ...rest,
    receipt,
    receiptPath: receiptUrl || null
  };
}

// GET /api/categories
router.get('/categories', async (req, res) => {
  try {
    const [categories] = await pool.query('SELECT * FROM categories ORDER BY type ASC, name ASC');
    return res.json({ success: true, categories });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/transactions - with filtering, search, pagination and summary
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, category, search, startDate, endDate, limit = 100, offset = 0 } = req.query;

    const conditions = ['t.user_id = ?'];
    const filterParams = [userId];

    if (type && ['income', 'expense'].includes(type)) {
      conditions.push('t.transaction_type = ?');
      filterParams.push(type);
    }

    if (category) {
      conditions.push('c.name = ?');
      filterParams.push(category);
    }

    if (search) {
      conditions.push('(t.description LIKE ? OR c.name LIKE ?)');
      filterParams.push(`%${search}%`, `%${search}%`);
    }

    if (startDate) {
      conditions.push('t.transaction_date >= ?');
      filterParams.push(startDate);
    }

    if (endDate) {
      conditions.push('t.transaction_date <= ?');
      filterParams.push(endDate);
    }

    const whereSql = `WHERE ${conditions.join(' AND ')}`;
    const baseFrom = `
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      ${whereSql}
    `;

    // Total rows for accurate pagination in the client.
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total ${baseFrom}`,
      filterParams
    );

    // Income/expense totals for the active filter set.
    const [summaryRows] = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN t.transaction_type = 'income' THEN t.amount ELSE 0 END), 0) AS total_income,
         COALESCE(SUM(CASE WHEN t.transaction_type = 'expense' THEN t.amount ELSE 0 END), 0) AS total_expense
       ${baseFrom}`,
      filterParams
    );

    const { limit: pageLimit, offset: pageOffset } = normalizePagination({ limit, offset });

    const [transactions] = await pool.query(
      `SELECT t.id, t.user_id, t.transaction_type as type, t.amount, t.description,
              t.transaction_date as date, t.created_at as createdAt,
              c.id as category_id, c.name as category, c.icon as category_icon, c.color as category_color,
              r.id as receipt_id, r.object_key as receiptKey, r.object_url as receiptUrl, r.filename as receiptName
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       LEFT JOIN receipts r ON r.transaction_id = t.id
       ${whereSql}
       ORDER BY t.transaction_date DESC, t.id DESC
       LIMIT ? OFFSET ?`,
      [...filterParams, pageLimit, pageOffset]
    );

    const transactionsWithReceipts = await Promise.all(
      transactions.map((row) => attachReceiptUrl(row, req))
    );

    return res.json({
      success: true,
      count: transactionsWithReceipts.length,
      total: Number(countRows[0]?.total || 0),
      summary: {
        totalIncome: Number(summaryRows[0]?.total_income || 0),
        totalExpense: Number(summaryRows[0]?.total_expense || 0)
      },
      transactions: transactionsWithReceipts
    });
  } catch (error) {
    console.error('Fetch transactions error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/transactions/:id/receipt-url - fresh presigned URL (for expired links)
router.get('/:id/receipt-url', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const [rows] = await pool.query(
      `SELECT r.object_key
       FROM transactions t
       JOIN receipts r ON r.transaction_id = t.id
       WHERE t.id = ? AND t.user_id = ?`,
      [id, userId]
    );

    if (rows.length === 0 || !rows[0].object_key) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    return res.json({
      success: true,
      url: await presignObject(rows[0].object_key, undefined, req),
      expiresIn: storageConfig.presignExpires
    });
  } catch (error) {
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
              r.id as receipt_id, r.object_key as receiptKey, r.object_url as receiptUrl, r.filename as receiptName
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       LEFT JOIN receipts r ON r.transaction_id = t.id
       WHERE t.id = ? AND t.user_id = ?`,
      [id, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    return res.json({ success: true, transaction: await attachReceiptUrl(rows[0], req) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/transactions
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const clientIp = req.ip || req.socket.remoteAddress;

    const validation = validateCreatePayload(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    const { type, amount, category, category_id, description, date } = validation.value;

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
    transactionsCreatedTotal.inc({ type });

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
    const clientIp = req.ip || req.socket.remoteAddress;

    const [existing] = await pool.query('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [id, userId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaction not found or unauthorized' });
    }

    const validation = validateUpdatePayload(req.body, existing[0]);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    const { type, amount, category, category_id, description, date } = validation.value;

    let finalCategoryId = category_id || existing[0].category_id;
    if (category) {
      const [cats] = await pool.query(
        'SELECT id FROM categories WHERE name = ? AND type = ? LIMIT 1',
        [category, type]
      );
      if (cats.length > 0) finalCategoryId = cats[0].id;
    }

    await pool.query(
      `UPDATE transactions 
       SET transaction_type = ?, amount = ?, category_id = ?, description = ?, transaction_date = ?
       WHERE id = ? AND user_id = ?`,
      [
        type,
        amount,
        finalCategoryId,
        description,
        date,
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

// POST /api/transactions/:id/receipt - upload/replace a receipt in MinIO
router.post('/:id/receipt', receiptUpload, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const clientIp = req.ip || req.socket.remoteAddress;

    if (!req.file) {
      receiptUploadsTotal.inc({ result: 'invalid' });
      return res.status(400).json({ success: false, message: 'Receipt file is required' });
    }

    const [existing] = await pool.query(
      'SELECT id FROM transactions WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaction not found or unauthorized' });
    }

    await ensureBucket();

    const safeName = (req.file.originalname || 'receipt')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(-120);
    const objectKey = `receipts/${userId}/${id}-${Date.now()}-${safeName}`;

    // 1. Upload the new object first so the existing receipt is never lost.
    await uploadObject(
      objectKey,
      req.file.buffer,
      req.file.mimetype || 'application/octet-stream'
    );

    const objectUrl = buildReceiptUrl(objectKey);
    const [oldReceipts] = await pool.query(
      'SELECT id, object_key FROM receipts WHERE transaction_id = ?',
      [id]
    );

    // 2. Swap the DB row atomically (one receipt per transaction).
    const connection = await pool.getConnection();
    let insertId;
    try {
      await connection.beginTransaction();
      await connection.query('DELETE FROM receipts WHERE transaction_id = ?', [id]);
      const [result] = await connection.query(
        `INSERT INTO receipts (transaction_id, object_url, object_key, filename, file_type, file_size)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          objectUrl,
          objectKey,
          req.file.originalname || safeName,
          req.file.mimetype || 'application/octet-stream',
          req.file.size
        ]
      );
      insertId = result.insertId;
      await connection.commit();
    } catch (dbError) {
      await connection.rollback();
      // Remove the orphaned upload; the previous receipt is still intact.
      await deleteObject(objectKey).catch(() => {});
      throw dbError;
    } finally {
      connection.release();
    }

    // 3. Only remove the old objects after the DB swap succeeded.
    for (const old of oldReceipts) {
      if (old.object_key) {
        try {
          await deleteObject(old.object_key);
        } catch (removeError) {
          console.warn('[Storage] Failed to remove old receipt:', removeError.message);
        }
      }
    }

    await logAudit({
      userId,
      action: 'RECEIPT_UPLOAD',
      entity: 'receipts',
      entityId: insertId,
      details: `Uploaded receipt for transaction ID ${id}`,
      ipAddress: clientIp
    });

    receiptUploadsTotal.inc({ result: 'success' });
    receiptUploadBytesTotal.inc(req.file.size);

    return res.status(201).json({
      success: true,
      message: 'Receipt uploaded successfully',
      receipt: {
        id: insertId,
        url: await presignObject(objectKey, undefined, req),
        path: objectUrl,
        filename: req.file.originalname || safeName,
        expiresIn: storageConfig.presignExpires
      }
    });
  } catch (error) {
    receiptUploadsTotal.inc({ result: 'error' });
    console.error('Receipt upload error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/transactions/:id/receipt
router.delete('/:id/receipt', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const [existing] = await pool.query(
      'SELECT id FROM transactions WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaction not found or unauthorized' });
    }

    const [receipts] = await pool.query(
      'SELECT id, object_key FROM receipts WHERE transaction_id = ?',
      [id]
    );

    // Remove the DB rows first; object cleanup is best-effort afterwards.
    await pool.query('DELETE FROM receipts WHERE transaction_id = ?', [id]);

    for (const receipt of receipts) {
      if (receipt.object_key) {
        try {
          await deleteObject(receipt.object_key);
        } catch (removeError) {
          console.warn('[Storage] Failed to remove receipt:', removeError.message);
        }
      }
    }

    return res.json({ success: true, message: 'Receipt deleted successfully' });
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

    const [existing] = await pool.query(
      'SELECT id, amount, transaction_type FROM transactions WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaction not found or unauthorized' });
    }

    // Fetch object keys, delete the DB row (cascade removes receipt rows),
    // then clean up MinIO best-effort so a DB failure never loses files first.
    const [receipts] = await pool.query(
      'SELECT object_key FROM receipts WHERE transaction_id = ?',
      [id]
    );

    await pool.query('DELETE FROM transactions WHERE id = ? AND user_id = ?', [id, userId]);

    for (const receipt of receipts) {
      if (receipt.object_key) {
        try {
          await deleteObject(receipt.object_key);
        } catch (removeError) {
          console.warn('[Storage] Failed to remove receipt:', removeError.message);
        }
      }
    }

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

