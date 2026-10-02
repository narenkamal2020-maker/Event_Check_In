import { getDb } from '../../src/db/index.js';
import { createEvent } from '../../server/src/services/eventService.js';
import { registerForEvent } from '../../server/src/services/registrationService.js';
import { hashPassword } from '../../server/src/security/auth.js';

async function runCapacityConcurrencyTest() {
  console.log('\n======================================================');
  console.log('STARTING CAPACITY CONCURRENCY TEST (100 Simultaneous Registrations)');
  console.log('======================================================');

  const db = await getDb();

  // 1. Create an organizer
  const pwd = await hashPassword('password123');
  const orgEmail = `cap-org-${Date.now()}@example.com`;
  const orgRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
     VALUES ('Capacity Org', $1, $2, 'ORGANIZER', NOW(), NOW())
     RETURNING id`,
    [orgEmail, pwd]
  );
  const organizerId = orgRes.rows[0].id;

  // 2. Create Event with Capacity 50
  const capacity = 50;
  const startTime = new Date();
  const endTime = new Date(Date.now() + 24 * 3600 * 1000);
  const event = await createEvent({
    organizerId,
    name: 'Strict Capacity Showcase (Cap 50)',
    location: 'Main Auditorium',
    startTime,
    endTime,
    capacity,
  });

  console.log(`Created Event ID ${event.id} with Capacity = ${capacity}`);

  // 3. Pre-create 100 distinct attendees
  console.log('Pre-creating 100 distinct attendee accounts...');
  const attendeeIds: number[] = [];
  for (let i = 0; i < 100; i++) {
    const email = `cap-user-${i}-${Date.now()}@example.com`;
    const res = await db.query(
      `INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, 'ATTENDEE', NOW(), NOW())
       RETURNING id`,
      [`User ${i}`, email, pwd]
    );
    attendeeIds.push(res.rows[0].id);
  }

  console.log('Firing 100 simultaneous registration requests concurrently...');

  // 4. Launch 100 simultaneous concurrent registration requests
  const promises = attendeeIds.map((attId) =>
    registerForEvent(attId, event.id)
      .then((res) => ({ success: true as const, status: res.status }))
      .catch((err) => ({ success: false as const, error: err.message }))
  );

  const results = await Promise.all(promises);

  const registeredCount = results.filter((r) => r.success && r.status === 'REGISTERED').length;
  const waitlistedCount = results.filter((r) => r.success && r.status === 'WAITLISTED').length;
  const errors = results.filter((r) => !r.success);

  // 5. Verify database records
  const dbRegisteredRes = await db.query(
    `SELECT COUNT(*)::int as count FROM registrations WHERE event_id = $1 AND status = 'REGISTERED'`,
    [event.id]
  );
  const finalDbRegistered = dbRegisteredRes.rows[0].count;

  const dbWaitlistRes = await db.query(
    `SELECT COUNT(*)::int as count FROM registrations WHERE event_id = $1 AND status = 'WAITLISTED'`,
    [event.id]
  );
  const finalDbWaitlisted = dbWaitlistRes.rows[0].count;

  console.log('\n-------------------------');
  console.log('CAPACITY CONCURRENCY TEST');
  console.log('-------------------------');
  console.log(`Capacity: ${capacity}`);
  console.log(`Requests: ${attendeeIds.length}`);
  console.log(`Success (REGISTERED): ${registeredCount}`);
  console.log(`Waitlisted: ${waitlistedCount}`);
  console.log(`Failed/Errored: ${errors.length}`);
  console.log(`Final DB registered: ${finalDbRegistered}`);
  console.log(`Final DB waitlisted: ${finalDbWaitlisted}`);

  if (
    registeredCount === capacity &&
    waitlistedCount === attendeeIds.length - capacity &&
    finalDbRegistered === capacity &&
    finalDbWaitlisted === attendeeIds.length - capacity
  ) {
    console.log('\nPASS ✓ Database-level row locking and capacity correctness verified!');
    console.log('======================================================\n');
    process.exit(0);
  } else {
    console.error('\nFAIL ✗ Capacity overflow or race condition detected!');
    console.error(`Expected exactly ${capacity} confirmed registrations and ${attendeeIds.length - capacity} waitlisted.`);
    console.log('======================================================\n');
    process.exit(1);
  }
}

runCapacityConcurrencyTest().catch((err) => {
  console.error('Fatal capacity test error:', err);
  process.exit(1);
});
