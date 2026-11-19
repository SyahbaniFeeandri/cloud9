import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { authAttemptsTotal } from '../config/metrics.js';
import { logAudit } from '../utils/audit.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// POST /api/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role = 'USER' } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    // Check existing email
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Email is already registered' });
    }

    // Get role id
    const [roles] = await pool.query('SELECT id FROM roles WHERE name = ?', [role.toUpperCase()]);
    const roleId = roles.length > 0 ? roles[0].id : 1;

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const [result] = await pool.query(
      'INSERT INTO users (role_id, name, email, password_hash) VALUES (?, ?, ?, ?)',
      [roleId, name, email, passwordHash]
    );

    const newUserId = result.insertId;

    // Audit log
    await logAudit({
      userId: newUserId,
      action: 'USER_REGISTER',
      entity: 'users',
      entityId: newUserId,
      details: `User registered: ${email}`,
      ipAddress: clientIp
    });

    const token = jwt.sign(
      { id: newUserId, email, name, role: role.toUpperCase() },
      process.env.JWT_SECRET || 'fincloud_super_secret_jwt_key_2026_cloud9',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: { id: newUserId, name, email, role: role.toUpperCase() }
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// POST /api/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress;

    if (!email || !password) {
      authAttemptsTotal.inc({ result: 'invalid_request' });
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const [users] = await pool.query(
      `SELECT u.id, u.name, u.email, u.password_hash, r.name as role 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.email = ?`,
      [email]
    );

    if (users.length === 0) {
      authAttemptsTotal.inc({ result: 'invalid_credentials' });
      await logAudit({
        userId: null,
        action: 'FAILED_LOGIN',
        details: `Failed login attempt for non-existing email: ${email}`,
        ipAddress: clientIp
      });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      authAttemptsTotal.inc({ result: 'invalid_credentials' });
      await logAudit({
        userId: user.id,
        action: 'FAILED_LOGIN',
        details: `Invalid password attempt for email: ${email}`,
        ipAddress: clientIp
      });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    authAttemptsTotal.inc({ result: 'success' });
    await logAudit({
      userId: user.id,
      action: 'USER_LOGIN',
      details: `User logged in: ${email}`,
      ipAddress: clientIp
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET || 'fincloud_super_secret_jwt_key_2026_cloud9',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    authAttemptsTotal.inc({ result: 'error' });
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// POST /api/logout
router.post('/logout', authenticateToken, async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress;
  await logAudit({
    userId: req.user.id,
    action: 'USER_LOGOUT',
    details: `User logged out`,
    ipAddress: clientIp
  });
  return res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, r.name as role, u.created_at 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({ success: true, user: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/profile - update the authenticated user's own name/email.
// Role changes are intentionally restricted to the admin area.
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, email } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required' });
    }

    const [duplicate] = await pool.query(
      'SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1',
      [email, req.user.id]
    );

    if (duplicate.length > 0) {
      return res.status(400).json({ success: false, message: 'Email is already registered' });
    }

    await pool.query('UPDATE users SET name = ?, email = ? WHERE id = ?', [
      name,
      email,
      req.user.id
    ]);

    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, r.name as role, u.created_at
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    await logAudit({
      userId: req.user.id,
      action: 'PROFILE_UPDATE',
      entity: 'users',
      entityId: req.user.id,
      details: `Profile updated for ${email}`,
      ipAddress: clientIp
    });

    return res.json({ success: true, message: 'Profile updated successfully', user: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

