import { getDb, DBClient } from '../../../src/db/index.js';
import { realtime } from '../realtime/socket.js';

export interface RecordSuspiciousInput {
  eventId: number;
  registrationId?: number | null;
  stationId?: number | null;
  type: 'DUPLICATE_SCAN' | 'RAPID_MULTI_STATION_SCAN' | 'INVALID_TOKEN' | 'EXPIRED_TOKEN' | 'REVOKED_TOKEN' | 'OFFLINE_SYNC_CONFLICT' | 'OTHER';
  severity?: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  metadata?: Record<string, any> | string;
}

export async function recordSuspiciousActivity(
  input: RecordSuspiciousInput,
  client?: DBClient
) {
  const db = client || (await getDb());
  const metaStr = typeof input.metadata === 'object' ? JSON.stringify(input.metadata) : input.metadata || null;
  const severity = input.severity || 'MEDIUM';

  const res = await db.query(
    `INSERT INTO suspicious_activity (event_id, registration_id, station_id, type, severity, description, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING *`,
    [
      input.eventId,
      input.registrationId || null,
      input.stationId || null,
      input.type,
      severity,
      input.description,
      metaStr,
    ]
  );

  const incident = res.rows[0];
  realtime.suspiciousActivityNew(input.eventId, incident);
  return incident;
}

export async function getSuspiciousActivity(eventId: number) {
  const db = await getDb();
  const res = await db.query(
    `SELECT 
       sa.*,
       r.registration_number,
       u.name as attendee_name,
       u.email as attendee_email,
       s.gate_name as station_gate_name,
       s.name as station_name
     FROM suspicious_activity sa
     LEFT JOIN registrations r ON r.id = sa.registration_id
     LEFT JOIN users u ON u.id = r.attendee_id
     LEFT JOIN stations s ON s.id = sa.station_id
     WHERE sa.event_id = $1
     ORDER BY sa.created_at DESC`,
    [eventId]
  );
  return res.rows;
}

export async function resolveSuspiciousActivity(id: number, resolution?: string, eventId?: number) {
  const db = await getDb();

  // Ensure the resolution_note column exists (gracefully)
  try {
    await db.query(`ALTER TABLE suspicious_activity ADD COLUMN IF NOT EXISTS resolution_note TEXT`);
  } catch (_) { /* ignore if already exists */ }

  let query = `UPDATE suspicious_activity SET resolved_at = NOW(), resolution_note = $2 WHERE id = $1`;
  const params: any[] = [id, resolution || 'Resolved by organizer'];

  if (eventId) {
    query += ` AND event_id = $3`;
    params.push(eventId);
  }

  query += ` RETURNING *`;

  const res = await db.query(query, params);
  if (res.rowCount === 0) {
    throw new Error('Suspicious activity record not found');
  }
  const row = res.rows[0];
  return { ...row, is_resolved: true, detected_at: row.created_at };
}
