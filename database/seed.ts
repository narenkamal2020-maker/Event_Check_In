import { getDb, ensureSchema } from '../src/db/index.js';
import { hashPassword } from '../server/src/security/auth.js';
import { generateTokenForRegistration } from '../server/src/services/qrService.js';

async function seed() {
  console.log('--- SEEDING EVENTRA DATABASE ---');
  const db = await getDb();
  await ensureSchema(db);

  // Clear existing data in correct foreign key order
  console.log('Clearing existing data...');
  await db.query('DELETE FROM audit_logs');
  await db.query('DELETE FROM suspicious_activity');
  await db.query('DELETE FROM offline_scans');
  await db.query('DELETE FROM check_ins');
  await db.query('DELETE FROM qr_tokens');
  await db.query('DELETE FROM registrations');
  await db.query('DELETE FROM stations');
  await db.query('DELETE FROM events');
  await db.query('DELETE FROM users');

  console.log('Creating demo users with hashed passwords...');
  const commonPasswordHash = await hashPassword('password123');
  const adminPasswordHash = await hashPassword('admin123');
  const organizerPasswordHash = await hashPassword('organizer123');
  const staffPasswordHash = await hashPassword('staff123');

  // 1. Admin
  const adminRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
     VALUES ('Eventra Admin', 'admin@eventra.app', $1, 'ADMIN', NOW(), NOW())
     RETURNING id, name, email, role`,
    [adminPasswordHash]
  );
  const adminUser = adminRes.rows[0];

  // 2. Organizer
  const orgRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
     VALUES ('Event Organizer', 'organizer@eventra.app', $1, 'ORGANIZER', NOW(), NOW())
     RETURNING id, name, email, role`,
    [organizerPasswordHash]
  );
  const organizerUser = orgRes.rows[0];

  // 3. Staff
  const staffRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
     VALUES ('Gate Officer', 'staff@eventra.app', $1, 'STAFF', NOW(), NOW())
     RETURNING id, name, email, role`,
    [staffPasswordHash]
  );
  const staffUser = staffRes.rows[0];

  // 4. Attendees
  const attendeeList = [
    { name: 'Naren', email: 'naren@example.com' },
    { name: 'Priya Sharma', email: 'priya@example.com' },
    { name: 'Alex Johnson', email: 'alex@example.com' },
    { name: 'Sarah Chen', email: 'sarah@example.com' },
    { name: 'Rahul Verma', email: 'rahul@example.com' },
    { name: 'Emily Davis', email: 'emily@example.com' },
    { name: 'David Miller', email: 'david@example.com' },
    { name: 'Ananya Patel', email: 'ananya@example.com' },
    { name: 'Marcus Vance', email: 'marcus@example.com' },
    { name: 'Elena Rostova', email: 'elena@example.com' },
    { name: 'Vikram Singh', email: 'vikram@example.com' },
    { name: 'Chloe Dubois', email: 'chloe@example.com' },
    { name: 'Liam Gallagher', email: 'liam@example.com' },
    { name: 'Aaliyah Khan', email: 'aaliyah@example.com' },
    { name: 'Carlos Gomez', email: 'carlos@example.com' },
  ];

  const attendees: any[] = [];
  for (const att of attendeeList) {
    const res = await db.query(
      `INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, 'ATTENDEE', NOW(), NOW())
       RETURNING id, name, email, role`,
      [att.name, att.email, commonPasswordHash]
    );
    attendees.push(res.rows[0]);
  }

  // 5. Create Flagship Event: Eventra TechSummit 2026
  console.log('Creating flagship event: Eventra TechSummit 2026...');
  const startTime = new Date();
  startTime.setHours(9, 0, 0, 0);
  const endTime = new Date();
  endTime.setHours(18, 0, 0, 0);

  const eventRes = await db.query(
    `INSERT INTO events (organizer_id, name, description, location, start_time, end_time, capacity, status, created_at, updated_at)
     VALUES ($1, 'Eventra TechSummit 2026', 'Premier annual technology summit featuring keynotes, hackathons, and recruitment tracks for top engineering talent.', 'Innovation Convention Center, Silicon District', $2, $3, 20, 'PUBLISHED', NOW(), NOW())
     RETURNING *`,
    [organizerUser.id, startTime, endTime]
  );
  const event = eventRes.rows[0];

  // 6. Create Stations
  console.log('Creating gate stations (Gate A, Gate B, Gate C)...');
  const gateA = (await db.query(
    `INSERT INTO stations (event_id, name, gate_name, created_at) VALUES ($1, 'Main Entrance', 'Gate A', NOW()) RETURNING *`,
    [event.id]
  )).rows[0];

  const gateB = (await db.query(
    `INSERT INTO stations (event_id, name, gate_name, created_at) VALUES ($1, 'VIP & Fast Track', 'Gate B', NOW()) RETURNING *`,
    [event.id]
  )).rows[0];

  const gateC = (await db.query(
    `INSERT INTO stations (event_id, name, gate_name, created_at) VALUES ($1, 'North Hall Gate', 'Gate C', NOW()) RETURNING *`,
    [event.id]
  )).rows[0];

  const stations = [gateA, gateB, gateC];

  // 7. Create Registrations & Check-Ins
  console.log('Registering attendees and simulating gate check-ins...');
  
  // First 6 attendees: CHECKED_IN
  for (let i = 0; i < 6; i++) {
    const att = attendees[i];
    const regNum = `EVT-${event.id}-${att.id}-00${i + 1}`;
    const regRes = await db.query(
      `INSERT INTO registrations (event_id, attendee_id, registration_number, status, registered_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'CHECKED_IN', NOW() - INTERVAL '3 hours', NOW(), NOW())
       RETURNING *`,
      [event.id, att.id, regNum]
    );
    const reg = regRes.rows[0];

    const token = await generateTokenForRegistration(reg.id);
    const st = stations[i % stations.length];

    const checkInTime = new Date(Date.now() - (60 - i * 8) * 60 * 1000); // spread across past hour
    await db.query(
      `INSERT INTO check_ins (registration_id, event_id, station_id, token_id, device_id, checked_in_at, sync_source, created_at)
       VALUES ($1, $2, $3, $4, 'POS-TERMINAL-01', $5, 'ONLINE', NOW())`,
      [reg.id, event.id, st.id, token.tokenId, checkInTime]
    );

    await db.query(`UPDATE qr_tokens SET used_at = $1 WHERE id = $2`, [checkInTime, token.tokenId]);
  }

  // Next 4 attendees: REGISTERED (Pending arrival)
  for (let i = 6; i < 10; i++) {
    const att = attendees[i];
    const regNum = `EVT-${event.id}-${att.id}-00${i + 1}`;
    const regRes = await db.query(
      `INSERT INTO registrations (event_id, attendee_id, registration_number, status, registered_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'REGISTERED', NOW() - INTERVAL '2 hours', NOW(), NOW())
       RETURNING *`,
      [event.id, att.id, regNum]
    );
    await generateTokenForRegistration(regRes.rows[0].id);
  }

  // Next 3 attendees: WAITLISTED
  for (let i = 10; i < 13; i++) {
    const att = attendees[i];
    const regNum = `EVT-${event.id}-${att.id}-WL${i - 9}`;
    await db.query(
      `INSERT INTO registrations (event_id, attendee_id, registration_number, status, registered_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'WAITLISTED', NOW() - INTERVAL '1 hour', NOW(), NOW())`,
      [event.id, att.id, regNum]
    );
  }

  // Last 2 attendees: CANCELLED
  for (let i = 13; i < 15; i++) {
    const att = attendees[i];
    const regNum = `EVT-${event.id}-${att.id}-CAN`;
    await db.query(
      `INSERT INTO registrations (event_id, attendee_id, registration_number, status, registered_at, cancelled_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'CANCELLED', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '30 minutes', NOW(), NOW())`,
      [event.id, att.id, regNum]
    );
  }

  // 8. Create Suspicious Activity Examples
  console.log('Seeding suspicious activity incidents for demonstration...');
  await db.query(
    `INSERT INTO suspicious_activity (event_id, registration_id, station_id, type, severity, description, metadata, created_at)
     VALUES ($1, (SELECT id FROM registrations WHERE status = 'CHECKED_IN' LIMIT 1), $2, 'DUPLICATE_SCAN', 'MEDIUM', 'Duplicate scan attempt detected for checked-in badge', '{"deviceId":"SCAN-TABLET-02"}', NOW() - INTERVAL '15 minutes')`,
    [event.id, gateB.id]
  );

  await db.query(
    `INSERT INTO suspicious_activity (event_id, registration_id, station_id, type, severity, description, metadata, created_at)
     VALUES ($1, NULL, $2, 'RAPID_MULTI_STATION_SCAN', 'HIGH', 'Rapid check-in attempt across Gate A and Gate C within 4 seconds', '{"timeDifferenceSeconds":4}', NOW() - INTERVAL '8 minutes')`,
    [event.id, gateC.id]
  );

  console.log('\n======================================================');
  console.log('✓ SEEDING COMPLETED SUCCESSFULLY!');
  console.log('======================================================');
  console.log('DEMO CREDENTIALS (DEVELOPMENT ONLY):');
  console.log('1. Admin:     admin@eventra.app     / admin123');
  console.log('2. Organizer: organizer@eventra.app / organizer123');
  console.log('3. Staff:     staff@eventra.app     / staff123');
  console.log('4. Attendee:  naren@example.com     / password123');
  console.log('              priya@example.com     / password123');
  console.log('======================================================\n');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
