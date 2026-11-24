import { pool } from '../config/db.js';

export async function logAudit({ userId = null, action, entity = null, entityId = null, details = null, ipAddress = null }) {
  // Structured stdout line: Promtail ships it to Loki so audit events are
  // available outside the database too (file/centralized log requirement).
  console.log(JSON.stringify({
    level: 'audit',
    ts: new Date().toISOString(),
    action,
    userId,
    entity,
    entityId,
    ipAddress,
    details
  }));

  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, action, entity, entityId, details, ipAddress]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}

