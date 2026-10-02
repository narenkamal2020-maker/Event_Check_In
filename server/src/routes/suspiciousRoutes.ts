import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import * as suspiciousController from '../controllers/analyticsController.js';
import * as suspiciousService from '../services/suspiciousService.js';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { Response } from 'express';
import { logAuditAction } from '../services/auditService.js';

const router = Router();

// GET /api/suspicious/:eventId - list incidents
router.get(
  '/:eventId',
  requireAuth,
  requireRole('ORGANIZER', 'ADMIN', 'STAFF'),
  suspiciousController.getSuspiciousActivity
);

// POST /api/suspicious/:id/resolve
router.post(
  '/:id/resolve',
  requireAuth,
  requireRole('ORGANIZER', 'ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const resolution = req.body.resolution || 'Resolved by organizer';
      const resolved = await suspiciousService.resolveSuspiciousActivity(id, resolution);
      await logAuditAction({
        userId: req.user?.userId,
        action: 'SUSPICIOUS_ACTIVITY_RESOLVED',
        metadata: { incidentId: id, resolution },
        req,
      });
      return res.json({ success: true, resolved });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: { code: 'RESOLVE_FAILED', message: err.message } });
    }
  }
);

export default router;
