import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import * as checkInService from '../services/checkInService.js';
import * as offlineSyncService from '../services/offlineSyncService.js';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { Response } from 'express';
import { logAuditAction } from '../services/auditService.js';
import { z } from 'zod';

const router = Router();

// POST /api/checkin/:eventId/scan  — frontend scanner endpoint
router.post(
  '/:eventId/scan',
  requireAuth,
  requireRole('ORGANIZER', 'ADMIN', 'STAFF'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const eventId = parseInt(req.params.eventId, 10);
      const { token, rawToken, stationId, deviceId, syncSource } = req.body;
      const actualToken = rawToken || token;

      if (!actualToken || !stationId) {
        return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'token and stationId required' } });
      }

      const result = await checkInService.checkInAttendee({
        eventId,
        rawToken: actualToken,
        stationId: parseInt(stationId, 10),
        deviceId,
        syncSource: syncSource || 'ONLINE',
      });

      await logAuditAction({
        userId: req.user?.userId,
        eventId,
        action: 'CHECK_IN_SUCCESS',
        metadata: { attendeeName: result.attendeeName, gate: result.gateName },
        req,
      });

      return res.json({
        success: true,
        attendeeName: result.attendeeName,
        registrationNumber: result.registrationNumber,
        gateName: result.gateName,
        checkedInAt: result.checkedInAt,
      });
    } catch (err: any) {
      const statusCode = err.code === 'ALREADY_CHECKED_IN' ? 409 : 400;
      return res.status(statusCode).json({
        success: false,
        error: { code: err.code || 'CHECK_IN_FAILED', message: err.message || 'Check-in failed' },
      });
    }
  }
);

// POST /api/checkin/:eventId/sync  — offline sync endpoint
router.post(
  '/:eventId/sync',
  requireAuth,
  requireRole('ORGANIZER', 'ADMIN', 'STAFF'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const eventId = parseInt(req.params.eventId, 10);
      const { scans } = req.body;

      if (!Array.isArray(scans) || scans.length === 0) {
        return res.status(400).json({ success: false, error: { code: 'MISSING_SCANS', message: 'scans array required' } });
      }

      const syncReport = await offlineSyncService.syncOfflineScans(eventId, scans);

      await logAuditAction({
        userId: req.user?.userId,
        eventId,
        action: 'OFFLINE_SYNC_COMPLETED',
        metadata: { total: syncReport.total, synced: syncReport.synced, conflicts: syncReport.conflicts },
        req,
      });

      return res.json({
        success: true,
        synced: syncReport.synced,
        conflicts: syncReport.conflicts,
        alreadyProcessed: syncReport.results.filter(r => r.status === 'ALREADY_PROCESSED').length,
        results: syncReport.results,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: { code: 'SYNC_FAILED', message: err.message } });
    }
  }
);

// GET /api/checkin/:eventId
router.get('/:eventId', requireAuth, requireRole('ORGANIZER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const eventId = parseInt(req.params.eventId, 10);
    const checkIns = await checkInService.getCheckIns(eventId, 50);
    return res.json({ success: true, checkIns });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
