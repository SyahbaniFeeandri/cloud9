import { Router } from 'express';
import os from 'os';
import { pool, testDbConnection } from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);
router.use(requireRole('ADMIN'));

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT u.id, u.name, u.email, r.name as role, u.created_at,
              COUNT(t.id) as total_transactions,
              COALESCE(SUM(t.amount), 0) as total_amount
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN transactions t ON t.user_id = u.id
       GROUP BY u.id, u.name, u.email, r.name, u.created_at
       ORDER BY u.id ASC`
    );

    return res.json({ success: true, count: users.length, users });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/audit-logs
router.get('/audit-logs', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const [logs] = await pool.query(
      `SELECT a.id, a.action, a.entity, a.entity_id, a.details, a.ip_address, a.created_at,
              u.email as user_email, u.name as user_name
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
      [parseInt(limit, 10), parseInt(offset, 10)]
    );

    return res.json({ success: true, count: logs.length, logs });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/system-status (System Monitor)
router.get('/system-status', async (req, res) => {
  try {
    const dbStatus = await testDbConnection();

    // Stats
    const [userCount] = await pool.query('SELECT COUNT(id) as count FROM users');
    const [txCount] = await pool.query('SELECT COUNT(id) as count, COALESCE(SUM(amount), 0) as total FROM transactions');
    const [receiptCount] = await pool.query('SELECT COUNT(id) as count FROM receipts');

    // System metrics
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsagePercent = ((usedMem / totalMem) * 100).toFixed(1);

    const cpus = os.cpus();
    const loadAvg = os.loadavg();

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      services: {
        backend: {
          status: 'HEALTHY',
          uptime: Math.floor(process.uptime()),
          nodeVersion: process.version
        },
        database: {
          status: dbStatus.connected ? 'CONNECTED' : 'DISCONNECTED',
          type: 'MariaDB',
          details: dbStatus.connected ? 'Pool Active' : dbStatus.error
        },
        objectStorage: {
          status: 'AVAILABLE',
          type: 'MinIO / S3 Driver',
          totalReceipts: receiptCount[0].count
        }
      },
      metrics: {
        cpuCount: cpus.length,
        cpuModel: cpus[0]?.model || 'Generic CPU',
        loadAverage: loadAvg,
        memoryUsagePercent: `${memoryUsagePercent}%`,
        totalMemoryMB: Math.round(totalMem / (1024 * 1024)),
        freeMemoryMB: Math.round(freeMem / (1024 * 1024))
      },
      platformStats: {
        activeUsers: userCount[0].count,
        totalTransactions: txCount[0].count,
        totalTransactionVolume: parseFloat(txCount[0].total)
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

