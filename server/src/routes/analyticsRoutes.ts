import { Router } from 'express';
import * as analyticsController from '../controllers/analyticsController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { aiInsightsRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// GET /api/analytics/:eventId - event stats
router.get(
  '/:eventId',
  requireAuth,
  requireRole('ORGANIZER', 'ADMIN', 'STAFF'),
  analyticsController.getStats
);

// POST /api/analytics/:eventId/ai-insight - Gemini AI question
router.post(
  '/:eventId/ai-insight',
  requireAuth,
  requireRole('ORGANIZER', 'ADMIN'),
  aiInsightsRateLimiter,
  analyticsController.askGeminiInsights
);

// GET /api/analytics/:eventId/export - CSV export
router.get(
  '/:eventId/export',
  requireAuth,
  requireRole('ORGANIZER', 'ADMIN'),
  analyticsController.exportCSV
);

export default router;
