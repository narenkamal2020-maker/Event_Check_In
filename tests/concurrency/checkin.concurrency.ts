import { getDb } from '../../src/db/index.js';
import { createEvent } from '../../server/src/services/eventService.js';
import { registerForEvent } from '../../server/src/services/registrationService.js';
import { checkInAttendee } from '../../server/src/services/checkInService.js';
import { hashPassword } from '../../server/src/security/auth.js';

async function runCheckInConcurrencyTest() {
  console.log('\n======================================================');
  console.log('STARTING CHECK-IN CONCURRENCY TEST (100 Concurrent Scans)');
  console.log('======================================================');

  const db = await getDb();

  // 1. Create a dedicated test organizer & attendee
  const pwd = await hashPassword('password123');
  const orgEmail = `test-org-${Date.now()}@example.com`;
  const orgRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
     VALUES ('Concurrency Org', $1, $2, 'ORGANIZER', NOW(), NOW())
     RETURNING id`,
    [orgEmail, pwd]
  );
  const organizerId = orgRes.rows[0].id;

  const attEmail = `test-att-${Date.now()}@example.com`;
  const attRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
     VALUES ('Test Attendee', $1, $2, 'ATTENDEE', NOW(), NOW())
     RETURNING id`,
    [attEmail, pwd]
  );
  const attendeeId = attRes.rows[0].id;

  // 2. Create Event with 3 Gates
  const startTime = new Date();
  const endTime = new Date(Date.now() + 24 * 3600 * 1000);
  const event = await createEvent({
    organizerId,
    name: 'High Concurrency Check-In Summit',
    location: 'Gate Testing Arena',
    startTime,
    endTime,
    capacity: 100,
    stations: [
      { name: 'Gate A Station', gateName: 'Gate A' },
      { name: 'Gate B Station', gateName: 'Gate B' },
      { name: 'Gate C Station', gateName: 'Gate C' },
    ],
  });

  const stationIds = event.stations.map((s: any) => s.id);

  // 3. Register Attendee and obtain active raw QR token
  const regResult = await registerForEvent(attendeeId, event.id);
  const rawToken = regResult.qrToken!.rawToken;
  const registrationId = regResult.id;

  console.log(`Registered Attendee ID: ${attendeeId}, Reg ID: ${registrationId}`);
  console.log(`Firing 100 simultaneous check-in requests against token...`);

  // 4. Launch 100 simultaneous concurrent check-ins
  const totalRequests = 100;
  const promises: Promise<{ success: boolean; error?: string }>[] = [];

  for (let i = 0; i < totalRequests; i++) {
    const stationId = stationIds[i % stationIds.length];
    const deviceId = `DEV-SCAN-${(i % 10) + 1}`;

    promises.push(
      checkInAttendee({
        eventId: event.id,
        rawToken,
        stationId,
        deviceId,
        syncSource: 'ONLINE',
      })
        .then(() => ({ success: true }))
        .catch((err) => ({ success: false, error: err.code || err.message }))
    );
  }

  const results = await Promise.all(promises);

  const successfulCheckIns = results.filter((r) => r.success).length;
  const rejectedCheckIns = results.filter((r) => !r.success).length;
  if (rejectedCheckIns > 0) {
    console.log('Sample rejection errors:', results.filter(r => !r.success).slice(0, 5).map(r => r.error));
  }

  // 5. Verify database records
  const dbCheckInsRes = await db.query(
    `SELECT COUNT(*)::int as count FROM check_ins WHERE registration_id = $1`,
    [registrationId]
  );
  const dbCount = dbCheckInsRes.rows[0].count;

  console.log('\n-------------------------');
  console.log('CHECK-IN CONCURRENCY TEST');
  console.log('-------------------------');
  console.log(`Requests: ${totalRequests}`);
  console.log(`Success: ${successfulCheckIns}`);
  console.log(`Rejected: ${rejectedCheckIns}`);
  console.log(`DB check-ins: ${dbCount}`);

  if (successfulCheckIns === 1 && rejectedCheckIns === totalRequests - 1 && dbCount === 1) {
    console.log('\nPASS ✓ Database-level duplicate protection verified!');
    console.log('======================================================\n');
    process.exit(0);
  } else {
    console.error('\nFAIL ✗ Concurrency violation detected!');
    console.error(`Expected 1 success and ${totalRequests - 1} rejections. Got ${successfulCheckIns} success.`);
    console.log('======================================================\n');
    process.exit(1);
  }
}

runCheckInConcurrencyTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
