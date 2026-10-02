import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

import { getDb, ensureSchema } from '../../src/db/index.js';
import { initSocketIO } from './realtime/socket.js';
import { authRateLimiter, apiRateLimiter } from './middleware/rateLimiter.js';

import authRoutes from './routes/authRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import registrationRoutes from './routes/registrationRoutes.js';
import checkInRoutes from './routes/checkInRoutes.js';
import suspiciousRoutes from './routes/suspiciousRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createExpressApp() {
  const app = express();

  // Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );

  // Parsers
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ─── Auth ───────────────────────────────────────────────────────
  app.use('/api/auth', authRateLimiter, authRoutes);

  // ─── Events ─────────────────────────────────────────────────────
  // Events router handles /api/events/* including nested register, check-in, stats
  app.use('/api/events', apiRateLimiter, eventRoutes);

  // ─── Registrations ──────────────────────────────────────────────
  // GET /api/registrations/my           → my registrations
  // GET/POST /api/registrations/:id/*   → pass, cancel
  // POST /api/registrations/:eventId/register (mirrors event route for frontend convenience)
  app.use('/api/registrations', apiRateLimiter, registrationRoutes);

  // ─── Check-In (direct scanner path) ─────────────────────────────
  // POST /api/checkin/:eventId/scan
  // POST /api/checkin/:eventId/sync
  app.use('/api/checkin', apiRateLimiter, checkInRoutes);

  // ─── Analytics ──────────────────────────────────────────────────
  // GET  /api/analytics/:eventId
  // POST /api/analytics/:eventId/ai-insight
  // GET  /api/analytics/:eventId/export?filter=...
  app.use('/api/analytics', apiRateLimiter, analyticsRoutes);

  // ─── Suspicious Activity ────────────────────────────────────────
  // GET  /api/suspicious/:eventId
  // POST /api/suspicious/:id/resolve
  app.use('/api/suspicious', apiRateLimiter, suspiciousRoutes);

  // ─── Admin ──────────────────────────────────────────────────────
  // GET    /api/admin/users
  // PATCH  /api/admin/users/:userId/role
  // DELETE /api/admin/users/:userId
  app.use('/api/admin', apiRateLimiter, adminRoutes);

  // Global Error Handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled server error:', err);
    const status = err.status || err.statusCode || 500;
    const code = err.code || 'INTERNAL_SERVER_ERROR';
    const message =
      process.env.NODE_ENV === 'production' && status === 500
        ? 'An unexpected internal error occurred'
        : err.message || 'Internal server error';

    res.status(status).json({ success: false, error: { code, message } });
  });

  return app;
}

export async function startServer() {
  const app = await createExpressApp();
  const server = http.createServer(app);
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Initialize Socket.IO
  initSocketIO(server);

  // Ensure DB schema
  try {
    const db = await getDb();
    await ensureSchema(db);
    console.log('Database connected and schema initialized.');
  } catch (err) {
    console.error('Database connection error:', err);
  }

  // Vite development middleware or production static serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, '../dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Eventra — Event Operations Platform running on http://localhost:${PORT}`);
    console.log(`   ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   DB:  ${process.env.DATABASE_URL ? 'PostgreSQL (remote)' : 'PGlite (embedded)'}`);
  });

  return { app, server };
}

// Start if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}
