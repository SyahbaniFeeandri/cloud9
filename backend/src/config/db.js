import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'webuser',
  password: process.env.DB_PASSWORD || 'GantiWebPass_123!',
  database: process.env.DB_NAME || 'fincloud_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 5000,
  dateStrings: true
});

// Helper check database connectivity
export async function testDbConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return { connected: true, message: 'MariaDB Connected' };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

