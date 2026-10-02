import crypto from 'crypto';
import { getDb, DBClient } from '../../../src/db/index.js';

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateRawToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export const QR_TOKEN_TTL_SECONDS = 60; // 60 seconds for rotating screenshot protection

export interface QRTokenResult {
  rawToken: string;
  tokenId: number;
  registrationId: number;
  expiresAt: Date;
}

export async function generateTokenForRegistration(
  registrationId: number,
  client?: DBClient,
  ttlSeconds: number = QR_TOKEN_TTL_SECONDS
): Promise<QRTokenResult> {
  const db = client || (await getDb());
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);

  // Revoke previous unused tokens for this registration
  await db.query(
    `UPDATE qr_tokens 
     SET revoked_at = NOW() 
     WHERE registration_id = $1 AND used_at IS NULL AND revoked_at IS NULL`,
    [registrationId]
  );

  const res = await db.query<{ id: number; expires_at: Date }>(
    `INSERT INTO qr_tokens (registration_id, token_hash, expires_at, created_at)
     VALUES ($1, $2, NOW() + ($3 * interval '1 second'), NOW())
     RETURNING id, expires_at`,
    [registrationId, tokenHash, ttlSeconds]
  );

  const row = res.rows[0];
  return {
    rawToken,
    tokenId: row.id,
    registrationId,
    expiresAt: row.expires_at,
  };
}

export async function getActiveTokenForRegistration(
  registrationId: number,
  attendeeId: number
): Promise<{ rawToken?: string; qrData: string; expiresAt: Date; registrationNumber: string; status: string }> {
  const db = await getDb();

  // Verify registration belongs to attendee or requester is authorized
  const regRes = await db.query(
    `SELECT r.*, e.name as event_name 
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     WHERE r.id = $1`,
    [registrationId]
  );

  if (regRes.rowCount === 0) {
    throw new Error('Registration not found');
  }

  const reg = regRes.rows[0];
  if (reg.attendee_id !== attendeeId && attendeeId !== -1) {
    throw new Error('Unauthorized to view this pass');
  }

  // Generate fresh token
  const tokenResult = await generateTokenForRegistration(registrationId);

  // QR payload contains secure token string
  const qrPayload = JSON.stringify({
    regId: registrationId,
    t: tokenResult.rawToken,
    eventId: reg.event_id,
  });

  return {
    rawToken: tokenResult.rawToken,
    qrData: qrPayload,
    expiresAt: tokenResult.expiresAt,
    registrationNumber: reg.registration_number,
    status: reg.status,
  };
}

export interface ValidationResult {
  valid: boolean;
  errorCode?: 'INVALID_TOKEN' | 'TOKEN_EXPIRED' | 'TOKEN_REVOKED' | 'TOKEN_USED' | 'REGISTRATION_NOT_ACTIVE' | 'WRONG_EVENT' | 'NOT_FOUND';
  errorMessage?: string;
  tokenRecord?: any;
  registration?: any;
  attendee?: any;
}

export async function validateToken(
  rawToken: string,
  eventId: number,
  client?: DBClient
): Promise<ValidationResult> {
  const db = client || (await getDb());
  const tokenHash = hashToken(rawToken);

  const res = await db.query(
    `SELECT 
       qt.id as token_id, qt.token_hash, qt.expires_at, qt.used_at, qt.revoked_at,
       (qt.expires_at < NOW()) as is_expired,
       r.id as registration_id, r.event_id, r.attendee_id, r.registration_number, r.status as reg_status,
       u.name as attendee_name, u.email as attendee_email,
       e.name as event_name, e.capacity, e.status as event_status
     FROM qr_tokens qt
     JOIN registrations r ON r.id = qt.registration_id
     JOIN users u ON u.id = r.attendee_id
     JOIN events e ON e.id = r.event_id
     WHERE qt.token_hash = $1`,
    [tokenHash]
  );

  if (res.rowCount === 0) {
    return {
      valid: false,
      errorCode: 'INVALID_TOKEN',
      errorMessage: 'QR token not found or invalid token signature',
    };
  }

  const row = res.rows[0];

  if (row.event_id !== eventId) {
    return {
      valid: false,
      errorCode: 'WRONG_EVENT',
      errorMessage: `This pass is for a different event (${row.event_name})`,
      registration: row,
    };
  }

  if (row.revoked_at) {
    return {
      valid: false,
      errorCode: 'TOKEN_REVOKED',
      errorMessage: 'This QR code was revoked or refreshed. Please display the latest pass.',
      tokenRecord: row,
      registration: row,
    };
  }

  if (row.used_at) {
    return {
      valid: false,
      errorCode: 'TOKEN_USED',
      errorMessage: 'This QR code has already been used for check-in.',
      tokenRecord: row,
      registration: row,
    };
  }

  if (row.is_expired) {
    return {
      valid: false,
      errorCode: 'TOKEN_EXPIRED',
      errorMessage: 'This rotating QR code has expired. Pass refreshes automatically.',
      tokenRecord: row,
      registration: row,
    };
  }

  if (row.reg_status === 'CANCELLED') {
    return {
      valid: false,
      errorCode: 'REGISTRATION_NOT_ACTIVE',
      errorMessage: 'Registration is cancelled',
      registration: row,
    };
  }

  if (row.reg_status === 'WAITLISTED') {
    return {
      valid: false,
      errorCode: 'REGISTRATION_NOT_ACTIVE',
      errorMessage: 'Attendee is currently on the waitlist and not confirmed',
      registration: row,
    };
  }

  return {
    valid: true,
    tokenRecord: {
      id: row.token_id,
      expiresAt: row.expires_at,
    },
    registration: {
      id: row.registration_id,
      eventId: row.event_id,
      attendeeId: row.attendee_id,
      registrationNumber: row.registration_number,
      status: row.reg_status,
      attendeeName: row.attendee_name,
      attendeeEmail: row.attendee_email,
    },
  };
}
