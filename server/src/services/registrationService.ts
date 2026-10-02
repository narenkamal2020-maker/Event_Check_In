import { getDb, DBClient } from '../../../src/db/index.js';
import { generateTokenForRegistration } from './qrService.js';
import { realtime } from '../realtime/socket.js';

export interface RegisterResult {
  id: number;
  eventId: number;
  attendeeId: number;
  registrationNumber: string;
  status: 'REGISTERED' | 'WAITLISTED' | 'CHECKED_IN' | 'CANCELLED';
  waitlistPosition?: number;
  qrToken?: {
    rawToken: string;
    expiresAt: Date;
  };
}

export async function registerForEvent(
  attendeeId: number,
  eventId: number,
  client?: DBClient
): Promise<RegisterResult> {
  const db = client || (await getDb());

  return await db.transaction(async (tx) => {
    // 1. Lock the event row for update to ensure strict serialized capacity check
    const eventRes = await tx.query(
      `SELECT id, name, capacity, status FROM events WHERE id = $1 FOR UPDATE`,
      [eventId]
    );

    if (eventRes.rowCount === 0) {
      throw new Error('Event not found');
    }

    const event = eventRes.rows[0];

    if (event.status === 'CANCELLED' || event.status === 'COMPLETED') {
      throw new Error(`Cannot register for an event with status: ${event.status}`);
    }

    // 2. Check if attendee already registered
    const existingRes = await tx.query(
      `SELECT id, status, registration_number FROM registrations WHERE event_id = $1 AND attendee_id = $2`,
      [eventId, attendeeId]
    );

    if (existingRes.rowCount > 0) {
      const existing = existingRes.rows[0];
      if (existing.status !== 'CANCELLED') {
        throw new Error('You are already registered for this event');
      }
    }

    // 3. Count confirmed registrations
    const countRes = await tx.query<{ count: string }>(
      `SELECT COUNT(*) as count 
       FROM registrations 
       WHERE event_id = $1 AND status IN ('REGISTERED', 'CHECKED_IN')`,
      [eventId]
    );

    const activeCount = parseInt(countRes.rows[0]?.count || '0', 10);
    const capacity = event.capacity;

    const registrationNumber = `EVT-${eventId}-${attendeeId}-${Math.floor(1000 + Math.random() * 9000)}`;

    let status: 'REGISTERED' | 'WAITLISTED' = 'REGISTERED';
    let waitlistPosition: number | undefined;

    if (activeCount >= capacity) {
      status = 'WAITLISTED';
      const wlCountRes = await tx.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM registrations WHERE event_id = $1 AND status = 'WAITLISTED'`,
        [eventId]
      );
      waitlistPosition = parseInt(wlCountRes.rows[0]?.count || '0', 10) + 1;
    }

    let regRow: any;
    if (existingRes.rowCount > 0 && existingRes.rows[0].status === 'CANCELLED') {
      // Re-activate cancelled registration
      const updateRes = await tx.query(
        `UPDATE registrations 
         SET status = $1, registered_at = NOW(), cancelled_at = NULL, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [status, existingRes.rows[0].id]
      );
      regRow = updateRes.rows[0];
    } else {
      // Insert new registration
      const insertRes = await tx.query(
        `INSERT INTO registrations (event_id, attendee_id, registration_number, status, registered_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
         RETURNING *`,
        [eventId, attendeeId, registrationNumber, status]
      );
      regRow = insertRes.rows[0];
    }

    let qrTokenData: { rawToken: string; expiresAt: Date } | undefined;

    // Generate initial QR token only if confirmed registered
    if (status === 'REGISTERED') {
      const qrRes = await generateTokenForRegistration(regRow.id, tx);
      qrTokenData = {
        rawToken: qrRes.rawToken,
        expiresAt: qrRes.expiresAt,
      };
    }

    const result: RegisterResult = {
      id: regRow.id,
      eventId: regRow.event_id,
      attendeeId: regRow.attendee_id,
      registrationNumber: regRow.registration_number,
      status: regRow.status,
      waitlistPosition,
      qrToken: qrTokenData,
    };

    realtime.registrationCreated(eventId, result);

    return result;
  });
}

export async function cancelRegistration(
  registrationId: number,
  attendeeId: number,
  isAdminOrOrganizer: boolean = false
) {
  const db = await getDb();

  return await db.transaction(async (tx) => {
    const regRes = await tx.query(
      `SELECT r.*, e.organizer_id 
       FROM registrations r
       JOIN events e ON e.id = r.event_id
       WHERE r.id = $1 FOR UPDATE`,
      [registrationId]
    );

    if (regRes.rowCount === 0) {
      throw new Error('Registration not found');
    }

    const reg = regRes.rows[0];

    if (!isAdminOrOrganizer && reg.attendee_id !== attendeeId) {
      throw new Error('Unauthorized to cancel this registration');
    }

    if (reg.status === 'CANCELLED') {
      throw new Error('Registration is already cancelled');
    }

    if (reg.status === 'CHECKED_IN') {
      throw new Error('Cannot cancel a registration that is already checked in');
    }

    const wasRegistered = reg.status === 'REGISTERED';

    // 1. Mark registration cancelled
    await tx.query(
      `UPDATE registrations 
       SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW() 
       WHERE id = $1`,
      [registrationId]
    );

    // 2. Revoke active QR tokens
    await tx.query(
      `UPDATE qr_tokens 
       SET revoked_at = NOW() 
       WHERE registration_id = $1 AND used_at IS NULL AND revoked_at IS NULL`,
      [registrationId]
    );

    let promotedAttendee: any = null;

    // 3. If the cancelled registration was confirmed, promote next waitlisted attendee atomically
    if (wasRegistered) {
      const waitlistedRes = await tx.query(
        `SELECT r.*, u.name as attendee_name, u.email as attendee_email
         FROM registrations r
         JOIN users u ON u.id = r.attendee_id
         WHERE r.event_id = $1 AND r.status = 'WAITLISTED'
         ORDER BY r.registered_at ASC, r.id ASC
         LIMIT 1
         FOR UPDATE`,
        [reg.event_id]
      );

      if (waitlistedRes.rowCount > 0) {
        const nextInLine = waitlistedRes.rows[0];
        await tx.query(
          `UPDATE registrations 
           SET status = 'REGISTERED', updated_at = NOW() 
           WHERE id = $1`,
          [nextInLine.id]
        );

        // Generate active QR token for promoted attendee
        await generateTokenForRegistration(nextInLine.id, tx);

        promotedAttendee = {
          registrationId: nextInLine.id,
          attendeeId: nextInLine.attendee_id,
          name: nextInLine.attendee_name,
          email: nextInLine.attendee_email,
        };

        realtime.waitlistPromoted(reg.event_id, promotedAttendee);
      }
    }

    realtime.registrationCancelled(reg.event_id, {
      registrationId,
      attendeeId: reg.attendee_id,
      promotedAttendee,
    });

    return {
      success: true,
      cancelledRegistrationId: registrationId,
      promotedAttendee,
    };
  });
}

export async function getRegistrations(eventId: number, status?: string) {
  const db = await getDb();
  let query = `
    SELECT 
      r.id, r.event_id, r.attendee_id, r.registration_number, r.status,
      r.registered_at, r.cancelled_at, r.created_at,
      u.name as attendee_name, u.email as attendee_email,
      c.checked_in_at, c.sync_source,
      s.gate_name as station_gate_name, s.name as station_name
    FROM registrations r
    JOIN users u ON u.id = r.attendee_id
    LEFT JOIN check_ins c ON c.registration_id = r.id
    LEFT JOIN stations s ON s.id = c.station_id
    WHERE r.event_id = $1
  `;

  const params: any[] = [eventId];
  if (status && status !== 'all') {
    params.push(status.toUpperCase());
    query += ` AND r.status = $${params.length}`;
  }

  query += ` ORDER BY r.registered_at ASC`;

  const res = await db.query(query, params);
  return res.rows;
}

export async function getUserRegistrations(attendeeId: number) {
  const db = await getDb();
  const res = await db.query(
    `SELECT 
       r.id, r.event_id, r.attendee_id, r.registration_number, r.status,
       r.waitlist_position, r.registered_at, r.cancelled_at, r.created_at,
       e.name as event_name, e.description as event_description,
       e.location as event_location,
       e.start_time as event_start,
       e.end_time as event_end_time, e.status as event_status,
       c.checked_in_at,
       s.gate_name as gate_name
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     LEFT JOIN check_ins c ON c.registration_id = r.id
     LEFT JOIN stations s ON s.id = c.station_id
     WHERE r.attendee_id = $1
     ORDER BY e.start_time DESC`,
    [attendeeId]
  );
  return res.rows;
}

export async function getRegistrationDetails(registrationId: number) {
  const db = await getDb();
  const res = await db.query(
    `SELECT 
       r.*,
       u.name as attendee_name, u.email as attendee_email,
       e.name as event_name, e.location as event_location,
       e.start_time as event_start_time, e.end_time as event_end_time,
       e.status as event_status, e.capacity as event_capacity,
       c.checked_in_at, c.sync_source,
       s.gate_name as station_gate_name
     FROM registrations r
     JOIN users u ON u.id = r.attendee_id
     JOIN events e ON e.id = r.event_id
     LEFT JOIN check_ins c ON c.registration_id = r.id
     LEFT JOIN stations s ON s.id = c.station_id
     WHERE r.id = $1`,
    [registrationId]
  );
  return res.rows[0] || null;
}
