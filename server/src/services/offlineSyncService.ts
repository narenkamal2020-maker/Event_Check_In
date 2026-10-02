import { getDb } from '../../../src/db/index.js';
import { checkInAttendee } from './checkInService.js';
import { recordSuspiciousActivity } from './suspiciousService.js';

export interface OfflineScanItem {
  clientScanId: string;
  registrationToken: string;
  stationId: number;
  deviceId?: string;
  scannedAtClient: string | Date;
}

export interface SyncBatchResult {
  total: number;
  synced: number;
  conflicts: number;
  rejected: number;
  results: Array<{
    clientScanId: string;
    status: 'SUCCESS' | 'CONFLICT' | 'REJECTED' | 'ALREADY_PROCESSED';
    attendeeName?: string;
    registrationNumber?: string;
    error?: string;
  }>;
}

export async function syncOfflineScans(
  eventId: number,
  scans: OfflineScanItem[]
): Promise<SyncBatchResult> {
  const db = await getDb();
  const results: SyncBatchResult['results'] = [];
  let synced = 0;
  let conflicts = 0;
  let rejected = 0;

  for (const scan of scans) {
    // 1. Check idempotency via client_scan_id
    const existingRes = await db.query(
      `SELECT * FROM offline_scans WHERE client_scan_id = $1`,
      [scan.clientScanId]
    );

    if (existingRes.rowCount > 0) {
      const existing = existingRes.rows[0];
      if (existing.sync_status === 'SYNCED') {
        results.push({
          clientScanId: scan.clientScanId,
          status: 'ALREADY_PROCESSED',
        });
        continue;
      }
    }

    const scannedDate = new Date(scan.scannedAtClient);

    try {
      // 2. Attempt check-in with OFFLINE_SYNC source
      const checkInResult = await checkInAttendee({
        eventId,
        rawToken: scan.registrationToken,
        stationId: scan.stationId,
        deviceId: scan.deviceId,
        syncSource: 'OFFLINE_SYNC',
      });

      // 3. Record successful offline scan
      if (existingRes.rowCount > 0) {
        await db.query(
          `UPDATE offline_scans 
           SET sync_status = 'SYNCED', synced_at = NOW(), conflict_reason = NULL 
           WHERE client_scan_id = $1`,
          [scan.clientScanId]
        );
      } else {
        await db.query(
          `INSERT INTO offline_scans (client_scan_id, event_id, registration_token, station_id, device_id, scanned_at_client, sync_status, synced_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'SYNCED', NOW(), NOW())`,
          [
            scan.clientScanId,
            eventId,
            scan.registrationToken,
            scan.stationId,
            scan.deviceId || null,
            scannedDate,
          ]
        );
      }

      synced++;
      results.push({
        clientScanId: scan.clientScanId,
        status: 'SUCCESS',
        attendeeName: checkInResult.attendeeName,
        registrationNumber: checkInResult.registrationNumber,
      });
    } catch (err: any) {
      const isConflict = err.code === 'ALREADY_CHECKED_IN' || err.code === 'TOKEN_USED' || err.message?.includes('already');
      const reason = err.message || 'Check-in validation failed';

      if (isConflict) {
        conflicts++;
        // Record offline conflict in suspicious activity
        await recordSuspiciousActivity({
          eventId,
          stationId: scan.stationId,
          type: 'OFFLINE_SYNC_CONFLICT',
          severity: 'HIGH',
          description: `Offline scan conflict: Attendee was already checked in online before offline scan synchronized`,
          metadata: {
            clientScanId: scan.clientScanId,
            deviceId: scan.deviceId,
            scannedAtClient: scan.scannedAtClient,
          },
        });
      } else {
        rejected++;
      }

      const status = isConflict ? 'CONFLICT' : 'REJECTED';

      if (existingRes.rowCount > 0) {
        await db.query(
          `UPDATE offline_scans 
           SET sync_status = $1, synced_at = NOW(), conflict_reason = $2 
           WHERE client_scan_id = $3`,
          [status, reason, scan.clientScanId]
        );
      } else {
        await db.query(
          `INSERT INTO offline_scans (client_scan_id, event_id, registration_token, station_id, device_id, scanned_at_client, sync_status, synced_at, conflict_reason, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, NOW())`,
          [
            scan.clientScanId,
            eventId,
            scan.registrationToken,
            scan.stationId,
            scan.deviceId || null,
            scannedDate,
            status,
            reason,
          ]
        );
      }

      results.push({
        clientScanId: scan.clientScanId,
        status,
        error: reason,
      });
    }
  }

  return {
    total: scans.length,
    synced,
    conflicts,
    rejected,
    results,
  };
}
