import { getDb, ensureSchema } from '../src/db/index.js';
import { hashPassword, comparePassword, generateToken, verifyToken } from '../server/src/security/auth.js';
import { createEvent, getEvents, getEventById } from '../server/src/services/eventService.js';
import { registerForEvent, cancelRegistration, getRegistrations } from '../server/src/services/registrationService.js';
import { generateTokenForRegistration, validateToken } from '../server/src/services/qrService.js';
import { checkInAttendee } from '../server/src/services/checkInService.js';
import { syncOfflineScans } from '../server/src/services/offlineSyncService.js';
import { generateEventInsight } from '../server/src/services/geminiService.js';
import { generateAttendanceCSV } from '../server/src/services/exportService.js';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}`);
  }
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('EVENTRA — AUTOMATED TEST SUITE');
  console.log('======================================================\n');

  const db = await getDb();
  await ensureSchema(db);

  console.log('1. Testing Security & Authentication...');
  const password = 'securePassword2026!';
  const hash = await hashPassword(password);
  assert(await comparePassword(password, hash), 'Password hashing and verification');
  assert(!(await comparePassword('wrongPassword', hash)), 'Rejection of incorrect password');

  const tokenPayload = { userId: 999, email: 'test@eventra.app', name: 'Test User', role: 'ORGANIZER' as const };
  const jwtToken = generateToken(tokenPayload);
  const decoded = verifyToken(jwtToken);
  assert(decoded.userId === 999 && decoded.role === 'ORGANIZER', 'JWT generation and payload verification');

  console.log('\n2. Testing Event & Station Lifecycle...');
  const orgEmail = `test-org-${Date.now()}@eventra.app`;
  const orgRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
     VALUES ('Test Org', $1, $2, 'ORGANIZER', NOW(), NOW()) RETURNING id`,
    [orgEmail, hash]
  );
  const organizerId = orgRes.rows[0].id;

  const event = await createEvent({
    organizerId,
    name: 'Automated Test Hackathon 2026',
    description: 'Unit testing event suite',
    location: 'Virtual Hall A',
    startTime: new Date(),
    endTime: new Date(Date.now() + 86400000),
    capacity: 2,
    stations: [
      { name: 'Front Desk', gateName: 'Gate A' },
      { name: 'Side Entrance', gateName: 'Gate B' },
    ],
  });

  assert(event.id > 0 && event.stations.length === 2, 'Event creation with multiple gate stations');

  const fetchedEvent = await getEventById(event.id);
  assert(fetchedEvent?.stations[0].gate_name === 'Gate A', 'Fetch event with station relationships');

  console.log('\n3. Testing Registration, Waitlist & Auto-Promotion...');
  const att1Res = await db.query(
    `INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
     VALUES ('Attendee 1', $1, $2, 'ATTENDEE', NOW(), NOW()) RETURNING id`,
    [`att1-${Date.now()}@example.com`, hash]
  );
  const att1Id = att1Res.rows[0].id;

  const att2Res = await db.query(
    `INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
     VALUES ('Attendee 2', $1, $2, 'ATTENDEE', NOW(), NOW()) RETURNING id`,
    [`att2-${Date.now()}@example.com`, hash]
  );
  const att2Id = att2Res.rows[0].id;

  const att3Res = await db.query(
    `INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
     VALUES ('Attendee 3', $1, $2, 'ATTENDEE', NOW(), NOW()) RETURNING id`,
    [`att3-${Date.now()}@example.com`, hash]
  );
  const att3Id = att3Res.rows[0].id;

  const reg1 = await registerForEvent(att1Id, event.id);
  const reg2 = await registerForEvent(att2Id, event.id);
  const reg3 = await registerForEvent(att3Id, event.id); // Capacity is 2 -> should be WAITLISTED!

  assert(reg1.status === 'REGISTERED' && reg1.qrToken !== undefined, 'Confirmed registration for slot 1');
  assert(reg2.status === 'REGISTERED' && reg2.qrToken !== undefined, 'Confirmed registration for slot 2');
  assert(reg3.status === 'WAITLISTED' && reg3.waitlistPosition === 1, 'Automatic waitlist assignment when capacity reached');

  // Test Waitlist Promotion upon cancellation
  const cancelRes = await cancelRegistration(reg1.id, att1Id);
  assert(cancelRes.promotedAttendee?.attendeeId === att3Id, 'Waitlist attendee auto-promoted when slot opens');

  const reg3Updated = (await getRegistrations(event.id)).find((r: any) => r.attendee_id === att3Id);
  assert(reg3Updated?.status === 'REGISTERED', 'Promoted attendee status updated to REGISTERED in database');

  console.log('\n4. Testing Rotating QR Security & Token Validation...');
  const qrTokenResult = await generateTokenForRegistration(reg2.id);
  const validation = await validateToken(qrTokenResult.rawToken, event.id);
  assert(validation.valid === true, 'Cryptographic token validation for active registration');

  const invalidValidation = await validateToken('fake-token-signature-xyz', event.id);
  assert(invalidValidation.valid === false && invalidValidation.errorCode === 'INVALID_TOKEN', 'Rejection of forged or non-existent QR token');

  console.log('\n5. Testing Check-In & Duplicate Protection...');
  const stationId = event.stations[0].id;
  const checkInResult = await checkInAttendee({
    eventId: event.id,
    rawToken: qrTokenResult.rawToken,
    stationId,
    deviceId: 'TEST-DEVICE-01',
    syncSource: 'ONLINE',
  });

  assert(checkInResult.success === true && checkInResult.gateName === 'Gate A', 'Successful check-in recorded');

  let duplicateRejected = false;
  try {
    await checkInAttendee({
      eventId: event.id,
      rawToken: qrTokenResult.rawToken,
      stationId,
      deviceId: 'TEST-DEVICE-02',
      syncSource: 'ONLINE',
    });
  } catch (err: any) {
    if (err.code === 'TOKEN_USED' || err.code === 'ALREADY_CHECKED_IN') {
      duplicateRejected = true;
    }
  }
  assert(duplicateRejected, 'Duplicate check-in rejected with database protection');

  console.log('\n6. Testing Offline Synchronization & Conflict Policy...');
  // Create a dedicated event for offline sync
  const offlineEvent = await createEvent({
    organizerId,
    name: 'Offline Sync Testing Event',
    location: 'Offline Testing Room',
    startTime: new Date(),
    endTime: new Date(Date.now() + 86400000),
    capacity: 10,
    stations: [{ name: 'Offline Gate', gateName: 'Gate A' }],
  });
  const offlineStationId = offlineEvent.stations[0].id;

  const att4Res = await db.query(
    `INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
     VALUES ('Attendee 4', $1, $2, 'ATTENDEE', NOW(), NOW()) RETURNING id`,
    [`att4-${Date.now()}@example.com`, hash]
  );
  const att4Id = att4Res.rows[0].id;
  const reg4 = await registerForEvent(att4Id, offlineEvent.id);

  const clientScanId1 = `offline-scan-uuid-${Date.now()}-1`;
  const clientScanId2 = `offline-scan-uuid-${Date.now()}-2`;

  const syncBatch = await syncOfflineScans(offlineEvent.id, [
    {
      clientScanId: clientScanId1,
      registrationToken: reg4.qrToken!.rawToken,
      stationId: offlineStationId,
      deviceId: 'OFFLINE-TABLET-1',
      scannedAtClient: new Date().toISOString(),
    },
    {
      // Attempt conflict by sending same token again
      clientScanId: clientScanId2,
      registrationToken: reg4.qrToken!.rawToken,
      stationId: offlineStationId,
      deviceId: 'OFFLINE-TABLET-1',
      scannedAtClient: new Date().toISOString(),
    },
  ]);

  assert(syncBatch.synced === 1 && syncBatch.conflicts === 1, 'Offline batch synchronization with server-authoritative conflict resolution');

  // Test idempotency by re-syncing the same clientScanId1
  const duplicateSyncBatch = await syncOfflineScans(offlineEvent.id, [
    {
      clientScanId: clientScanId1,
      registrationToken: reg4.qrToken!.rawToken,
      stationId: offlineStationId,
      deviceId: 'OFFLINE-TABLET-1',
      scannedAtClient: new Date().toISOString(),
    }
  ]);
  assert(duplicateSyncBatch.results[0].status === 'ALREADY_PROCESSED', 'Idempotent handling of duplicate offline scan submissions');

  console.log('\n7. Testing AI Insights Service & Verified Stats Fallback...');
  const aiInsight = await generateEventInsight(event.id, 'How many people have checked in so far?');
  assert(aiInsight.verifiedStats.totalCheckedIn >= 1, 'AI service ground-truth calculation from PostgreSQL data');
  assert(aiInsight.answer.length > 10, 'AI insight formatted response generated');

  console.log('\n8. Testing CSV Export Generator...');
  const csvContent = await generateAttendanceCSV(event.id, 'all');
  assert(csvContent.includes('Registration Number') && csvContent.includes('Check-in Station'), 'RFC-4180 formatted CSV export generated with all required headers');

  console.log('\n======================================================');
  console.log(`TEST RUN COMPLETED: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('======================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
