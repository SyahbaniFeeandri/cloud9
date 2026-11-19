import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createCorsOptions } from './middleware/cors.js';
import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import dashboardRoutes from './routes/dashboard.js';
import reportsRoutes from './routes/reports.js';
import adminRoutes from './routes/admin.js';
import { testDbConnection } from './config/db.js';
import { ensureBucket, getStorageStatus, storageConfig } from './config/storage.js';
import {
  metricsMiddleware,
  metricsHandler,
  dbUp,
  storageUp
} from './config/metrics.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// The backend sits behind the Nginx edge, which sets X-Forwarded-Proto/Host.
// Trusting that single hop lets req.protocol and receipt presigning reflect
// whether the browser is using HTTP or HTTPS.
app.set('trust proxy', 1);

// Middleware
app.disable('x-powered-by');
app.use(cors(createCorsOptions()));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Prometheus request metrics (default process metrics + HTTP RED metrics).
app.use(metricsMiddleware);

// Root & Health Check
app.get('/', (req, res) => {
  res.json({
    app: 'FinCloud API',
    version: '1.0.0',
    description: 'Financial Management Platform Backend API with MariaDB',
    endpoints: {
      auth: '/api/auth',
      transactions: '/api/transactions',
      dashboard: '/api/dashboard',
      reports: '/api/reports',
      admin: '/api/admin',
      health: '/api/health',
      metrics: '/metrics'
    }
  });
});

app.get('/api/health', async (req, res) => {
  const dbStatus = await testDbConnection();
  const storageStatus = await getStorageStatus();

  dbUp.set(dbStatus.connected ? 1 : 0);
  storageUp.set(storageStatus.connected ? 1 : 0);

  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    storage: storageStatus
  });
});

// Prometheus scrape endpoint. Kept outside /api so Nginx does not proxy it
// publicly; Prometheus reaches it over the internal Docker network.
app.get('/metrics', metricsHandler);

// Receipt objects are served through short-lived presigned MinIO URLs, so no
// public proxy is exposed here. Anonymous access to the bucket is denied.

// API Routes
app.use('/api', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/admin', adminRoutes);

// Fallback 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'API route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` FinCloud REST API Server running on port ${PORT}`);
  console.log(` Target Database: MariaDB (${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME})`);
  console.log(` Object Storage: MinIO (${storageConfig.internalEndpoint}/${storageConfig.bucket})`);
  console.log(` Presigned URLs: ${storageConfig.publicEndpoint} (TTL ${storageConfig.presignExpires}s)`);
  console.log(`=========================================`);

  // Ensure the receipts bucket exists; retries while MinIO starts up.
  ensureBucket().catch((error) => {
    console.error('[MinIO] Initialization error:', error.message);
  });

  // Keep the DB/storage gauges fresh even when /api/health is not called.
  const refreshServiceGauges = async () => {
    try {
      const [dbStatus, storageStatus] = await Promise.all([
        testDbConnection(),
        getStorageStatus()
      ]);
      dbUp.set(dbStatus.connected ? 1 : 0);
      storageUp.set(storageStatus.connected ? 1 : 0);
    } catch (error) {
      console.warn('[Metrics] Gauge refresh failed:', error.message);
    }
  };

  refreshServiceGauges();
  const gaugeTimer = setInterval(refreshServiceGauges, 15000);
  gaugeTimer.unref();
});

