import { getDb } from '../../../src/db/index.js';

export async function generateAttendanceCSV(
  eventId: number,
  statusFilter: string = 'all'
): Promise<string> {
  const db = await getDb();

  let query = `
    SELECT 
      u.name as attendee_name,
      u.email as attendee_email,
      r.registration_number,
      r.registered_at,
      r.status as registration_status,
      c.checked_in_at,
      s.gate_name as station_gate_name,
      c.sync_source,
      CASE WHEN (SELECT COUNT(*) FROM suspicious_activity sa WHERE sa.registration_id = r.id) > 0 THEN 'YES' ELSE 'NO' END as is_suspicious
    FROM registrations r
    JOIN users u ON u.id = r.attendee_id
    LEFT JOIN check_ins c ON c.registration_id = r.id
    LEFT JOIN stations s ON s.id = c.station_id
    WHERE r.event_id = $1
  `;

  const params: any[] = [eventId];

  const filter = statusFilter.toLowerCase();
  if (filter === 'checked_in') {
    query += ` AND r.status = 'CHECKED_IN'`;
  } else if (filter === 'not_checked_in') {
    query += ` AND r.status = 'REGISTERED'`;
  } else if (filter === 'cancelled') {
    query += ` AND r.status = 'CANCELLED'`;
  } else if (filter === 'waitlisted') {
    query += ` AND r.status = 'WAITLISTED'`;
  } else if (filter === 'suspicious') {
    query += ` AND (SELECT COUNT(*) FROM suspicious_activity sa WHERE sa.registration_id = r.id) > 0`;
  }

  query += ` ORDER BY r.registered_at ASC`;

  const res = await db.query(query, params);

  // Build CSV headers and rows
  const headers = [
    'Name',
    'Email',
    'Registration Number',
    'Registration Time',
    'Registration Status',
    'Check-in Time',
    'Check-in Station',
    'Sync Source',
    'Suspicious Flag',
  ];

  const escapeCSV = (str: any) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = res.rows.map((row: any) => [
    escapeCSV(row.attendee_name),
    escapeCSV(row.attendee_email),
    escapeCSV(row.registration_number),
    escapeCSV(row.registered_at ? new Date(row.registered_at).toISOString() : 'N/A'),
    escapeCSV(row.registration_status),
    escapeCSV(row.checked_in_at ? new Date(row.checked_in_at).toISOString() : 'N/A'),
    escapeCSV(row.station_gate_name || 'N/A'),
    escapeCSV(row.sync_source || 'N/A'),
    escapeCSV(row.is_suspicious),
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}
