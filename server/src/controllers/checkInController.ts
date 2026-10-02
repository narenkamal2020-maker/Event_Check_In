import { Response } from 'express';
import { z } from 'zod';
import * as checkInService from '../services/checkInService.js';
import * as offlineSyncService from '../services/offlineSyncService.js';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { logAuditAction } from '../services/auditService.js';

const checkInSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  stationId: z.number().int().positive('Station ID is required'),
  deviceId: z.string().optional(),
});

const syncSchema = z.object({
  scans: z.array(z.object({
    clientScanId: z.string().min(1),
    registrationToken: z.string().min(1),
    stationId: z.number().int().positive(),
    deviceId: z.string().optional(),
    scannedAtClient: z.string().min(1),
  })).min(1, 'At least one scan is required'),
});

export async function checkIn(req: AuthenticatedRequest, res: Response) {
  try {
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid event ID' } });
    }

    const { token, stationId, deviceId } = checkInSchema.parse(req.body);

    // If token is JSON encoded payload from pass QR, extract raw token
    let rawToken = token;
    try {
      if (token.startsWith('{') && token.endsWith('}')) {
        const parsed = JSON.parse(token);
        if (parsed.t) rawToken = parsed.t;
      }
    } catch (e) {
      // Keep as string
    }

    const checkInRecord = await checkInService.checkInAttendee({
      eventId,
      rawToken,
      stationId,
      deviceId,
      syncSource: 'ONLINE',
    });

    await logAuditAction({
      userId: req.user?.userId,
      eventId,
      action: 'CHECK_IN_SUCCESS',
      metadata: {
        registrationNumber: checkInRecord.registrationNumber,
        attendeeName: checkInRecord.attendeeName,
        station: checkInRecord.gateName,
      },
      req,
    });

    return res.status(200).json({
      success: true,
      checkIn: checkInRecord,
    });
  } catch (error: any) {
    const isAlreadyCheckedIn = error.code === 'ALREADY_CHECKED_IN' || error.message?.includes('already checked in');
    const isExpired = error.code === 'TOKEN_EXPIRED';
    const isRevoked = error.code === 'TOKEN_REVOKED';

    const statusCode = isAlreadyCheckedIn ? 409 : 400;

    return res.status(statusCode).json({
      success: false,
      error: {
        code: error.code || 'CHECK_IN_FAILED',
        message: error.message || 'Check-in failed',
        originalCheckInAt: error.originalCheckInAt,
      }
    });
  }
}

export async function syncOfflineScans(req: AuthenticatedRequest, res: Response) {
  try {
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid event ID' } });
    }

    const { scans } = syncSchema.parse(req.body);

    // Normalize rawTokens if JSON encoded
    const normalizedScans = scans.map(s => {
      let raw = s.registrationToken;
      try {
        if (raw.startsWith('{') && raw.endsWith('}')) {
          const parsed = JSON.parse(raw);
          if (parsed.t) raw = parsed.t;
        }
      } catch (e) {}
      return {
        ...s,
        registrationToken: raw,
      };
    });

    const syncReport = await offlineSyncService.syncOfflineScans(eventId, normalizedScans);

    await logAuditAction({
      userId: req.user?.userId,
      eventId,
      action: 'OFFLINE_SYNC_COMPLETED',
      metadata: {
        total: syncReport.total,
        synced: syncReport.synced,
        conflicts: syncReport.conflicts,
      },
      req,
    });

    return res.json({
      success: true,
      report: syncReport,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues[0]?.message || 'Invalid sync payload',
          details: error.issues,
        }
      });
    }
    console.error('Error synchronizing offline scans:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SYNC_FAILED', message: error.message || 'Failed to sync offline scans' }
    });
  }
}

export async function getEventCheckIns(req: AuthenticatedRequest, res: Response) {
  try {
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid event ID' } });
    }
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const checkIns = await checkInService.getCheckIns(eventId, limit);
    return res.json({
      success: true,
      checkIns,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch check-ins' }
    });
  }
}
