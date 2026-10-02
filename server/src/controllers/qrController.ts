import { Response } from 'express';
import QRCode from 'qrcode';
import * as qrService from '../services/qrService.js';
import { getDb } from '../../../src/db/index.js';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';

export async function getActivePass(req: AuthenticatedRequest, res: Response) {
  try {
    const registrationId = parseInt(req.params.registrationId, 10);
    if (isNaN(registrationId)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid registration ID' } });
    }
    const userId = req.user?.role === 'ATTENDEE' ? req.user.userId : -1;

    const db = await getDb();

    // Fetch full registration + event + attendee info
    const regRes = await db.query(
      `SELECT 
         r.id, r.event_id, r.attendee_id, r.status, r.registration_number,
         r.waitlist_position, r.checked_in_at, r.created_at,
         e.name as event_name, e.location as event_location,
         e.start_time as event_start_time, e.end_time as event_end_time,
         u.name as attendee_name, u.email as attendee_email,
         ci.station_id, s.gate_name
       FROM registrations r
       JOIN events e ON e.id = r.event_id
       JOIN users u ON u.id = r.attendee_id
       LEFT JOIN check_ins ci ON ci.registration_id = r.id
       LEFT JOIN stations s ON s.id = ci.station_id
       WHERE r.id = $1`,
      [registrationId]
    );

    if (regRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Registration not found' } });
    }

    const reg = regRes.rows[0];

    if (userId !== -1 && reg.attendee_id !== userId) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    // Generate token and QR code data URL
    const tokenResult = await qrService.generateTokenForRegistration(registrationId);

    const qrPayload = JSON.stringify({
      regId: registrationId,
      t: tokenResult.rawToken,
      eventId: reg.event_id,
    });

    const qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 280,
      color: { dark: '#000000', light: '#FFFFFF' },
    });

    const expiresInSeconds = Math.max(0, Math.round((tokenResult.expiresAt.getTime() - Date.now()) / 1000));

    return res.json({
      success: true,
      registration: reg,
      qrCodeDataUrl,
      expiresInSeconds,
      rawToken: tokenResult.rawToken,
      gateName: reg.gate_name || null,
    });
  } catch (error: any) {
    console.error('Error fetching digital pass QR:', error);
    return res.status(400).json({
      success: false,
      error: { code: 'QR_FETCH_FAILED', message: error.message || 'Failed to fetch pass' },
    });
  }
}

export async function refreshQRToken(req: AuthenticatedRequest, res: Response) {
  return getActivePass(req, res);
}
