import { getDb, DBClient } from '../../../src/db/index.js';
import { validateToken } from './qrService.js';
import { recordSuspiciousActivity } from './suspiciousService.js';
import { realtime } from '../realtime/socket.js';
import { logAuditAction } from './auditService.js';

export interface CheckInInput {
  eventId: number;
  rawToken: string;
  stationId: number;
  deviceId?: string;
  syncSource?: 'ONLINE' | 'OFFLINE_SYNC';
}

export interface CheckInResult {
  success: boolean;
  checkInId: number;
  registrationId: number;
  attendeeName: string;
  attendeeEmail: string;
  registrationNumber: string;
  stationName: string;
  gateName: string;
  checkedInAt: Date;
  syncSource: string;
}

export async function checkInAttendee(
  input: CheckInInput,
  client?: DBClient
): Promise<CheckInResult> {
  const db = client || (await getDb());

  return await db.transaction(async (tx) => {
    // 1. Validate QR token cryptographically
    const valResult = await validateToken(input.rawToken, input.eventId, tx);

    if (!valResult.valid) {
      // Record suspicious activity deterministically
      let suspType: any = 'INVALID_TOKEN';
      let severity: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';

      if (valResult.errorCode === 'TOKEN_EXPIRED') {
        suspType = 'EXPIRED_TOKEN';
        severity = 'LOW';
      } else if (valResult.errorCode === 'TOKEN_REVOKED') {
        suspType = 'REVOKED_TOKEN';
        severity = 'MEDIUM';
      } else if (valResult.errorCode === 'WRONG_EVENT') {
        suspType = 'OTHER';
        severity = 'MEDIUM';
      }

      await recordSuspiciousActivity(
        {
          eventId: input.eventId,
          registrationId: valResult.registration?.id || null,
          stationId: input.stationId,
          type: suspType,
          severity,
          description: `Check-in rejected: ${valResult.errorMessage || 'Invalid token'}`,
          metadata: {
            deviceId: input.deviceId,
            syncSource: input.syncSource || 'ONLINE',
            errorCode: valResult.errorCode,
          },
        },
        tx
      );

      realtime.checkInRejected(input.eventId, {
        reason: valResult.errorMessage,
        code: valResult.errorCode,
        stationId: input.stationId,
      });

      const err: any = new Error(valResult.errorMessage || 'Invalid QR code');
      err.code = valResult.errorCode;
      throw err;
    }

    const { registration, tokenRecord } = valResult;

    // 2. Concurrency-safe check for existing check-in
    const existingCheckInRes = await tx.query(
      `SELECT c.*, s.gate_name as prior_gate 
       FROM check_ins c
       LEFT JOIN stations s ON s.id = c.station_id
       WHERE c.registration_id = $1`,
      [registration.id]
    );

    if (existingCheckInRes.rowCount > 0) {
      const prior = existingCheckInRes.rows[0];
      const priorTime = new Date(prior.checked_in_at).getTime();
      const nowTime = Date.now();
      const timeDiffSeconds = Math.abs(nowTime - priorTime) / 1000;

      // Check if scanned at different station rapidly (< 60s)
      if (prior.station_id !== input.stationId && timeDiffSeconds < 60) {
        await recordSuspiciousActivity(
          {
            eventId: input.eventId,
            registrationId: registration.id,
            stationId: input.stationId,
            type: 'RAPID_MULTI_STATION_SCAN',
            severity: 'HIGH',
            description: `Rapid scan across multiple gates: Previously at ${prior.prior_gate || 'Station ' + prior.station_id} ${Math.round(timeDiffSeconds)}s ago`,
            metadata: {
              priorStationId: prior.station_id,
              priorGate: prior.prior_gate,
              priorCheckedInAt: prior.checked_in_at,
              currentStationId: input.stationId,
              timeDifferenceSeconds: timeDiffSeconds,
            },
          },
          tx
        );
      } else {
        await recordSuspiciousActivity(
          {
            eventId: input.eventId,
            registrationId: registration.id,
            stationId: input.stationId,
            type: 'DUPLICATE_SCAN',
            severity: 'MEDIUM',
            description: `Duplicate scan attempt for ${registration.attendeeName} (${registration.registrationNumber})`,
            metadata: {
              originalCheckInAt: prior.checked_in_at,
              originalStationId: prior.station_id,
            },
          },
          tx
        );
      }

      realtime.checkInRejected(input.eventId, {
        reason: 'Attendee has already checked in',
        code: 'ALREADY_CHECKED_IN',
        attendeeName: registration.attendeeName,
        registrationNumber: registration.registrationNumber,
        originalCheckInAt: prior.checked_in_at,
      });

      const err: any = new Error('Attendee is already checked in');
      err.code = 'ALREADY_CHECKED_IN';
      err.originalCheckInAt = prior.checked_in_at;
      throw err;
    }

    // 3. Insert check-in atomically
    let checkInRow: any;
    try {
      const insertRes = await tx.query(
        `INSERT INTO check_ins (registration_id, event_id, station_id, token_id, device_id, checked_in_at, sync_source, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6, NOW())
         RETURNING *`,
        [
          registration.id,
          input.eventId,
          input.stationId,
          tokenRecord.id,
          input.deviceId || null,
          input.syncSource || 'ONLINE',
        ]
      );
      checkInRow = insertRes.rows[0];
    } catch (insertErr: any) {
      // Handle race condition caught by UNIQUE(registration_id)
      if (insertErr.message?.includes('unique') || insertErr.code === '23505') {
        const err: any = new Error('Attendee is already checked in (concurrent conflict resolved)');
        err.code = 'ALREADY_CHECKED_IN';
        throw err;
      }
      throw insertErr;
    }

    // 4. Mark token used
    await tx.query(
      `UPDATE qr_tokens SET used_at = NOW() WHERE id = $1`,
      [tokenRecord.id]
    );

    // 5. Update registration status
    await tx.query(
      `UPDATE registrations SET status = 'CHECKED_IN', updated_at = NOW() WHERE id = $1`,
      [registration.id]
    );

    // 6. Fetch station details
    const stationRes = await tx.query(
      `SELECT name, gate_name FROM stations WHERE id = $1`,
      [input.stationId]
    );
    const station = stationRes.rows[0] || { name: 'Gate', gate_name: 'Main Gate' };

    const result: CheckInResult = {
      success: true,
      checkInId: checkInRow.id,
      registrationId: registration.id,
      attendeeName: registration.attendeeName,
      attendeeEmail: registration.attendeeEmail,
      registrationNumber: registration.registrationNumber,
      stationName: station.name,
      gateName: station.gate_name,
      checkedInAt: checkInRow.checked_in_at,
      syncSource: checkInRow.sync_source,
    };

    // 7. Emit realtime check-in event
    realtime.checkInSuccess(input.eventId, result);

    return result;
  });
}

export async function getCheckIns(eventId: number, limit: number = 50) {
  const db = await getDb();
  const res = await db.query(
    `SELECT 
       c.id, c.registration_id, c.event_id, c.station_id, c.device_id, c.checked_in_at, c.sync_source,
       r.registration_number,
       u.name as attendee_name, u.email as attendee_email,
       s.name as station_name, s.gate_name as station_gate_name
     FROM check_ins c
     JOIN registrations r ON r.id = c.registration_id
     JOIN users u ON u.id = r.attendee_id
     JOIN stations s ON s.id = c.station_id
     WHERE c.event_id = $1
     ORDER BY c.checked_in_at DESC
     LIMIT $2`,
    [eventId, limit]
  );
  return res.rows;
}
