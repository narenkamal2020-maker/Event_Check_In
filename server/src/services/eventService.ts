import { getDb, DBClient } from '../../../src/db/index.js';

export interface CreateEventInput {
  organizerId: number;
  name: string;
  description?: string;
  location: string;
  startTime: Date | string;
  endTime: Date | string;
  capacity: number;
  status?: 'DRAFT' | 'PUBLISHED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  stations?: Array<{ name: string; gateName: string }>;
}

export async function createEvent(data: CreateEventInput, client?: DBClient) {
  const db = client || (await getDb());

  const startTime = new Date(data.startTime);
  const endTime = new Date(data.endTime);

  if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
    throw new Error('Invalid start or end date format');
  }

  if (startTime >= endTime) {
    throw new Error('Start time must be before end time');
  }

  if (data.capacity <= 0) {
    throw new Error('Event capacity must be greater than 0');
  }

  return await db.transaction(async (tx) => {
    const eventRes = await tx.query<any>(
      `INSERT INTO events (organizer_id, name, description, location, start_time, end_time, capacity, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING *`,
      [
        data.organizerId,
        data.name.trim(),
        data.description || null,
        data.location.trim(),
        startTime,
        endTime,
        data.capacity,
        data.status || 'PUBLISHED',
      ]
    );

    const event = eventRes.rows[0];

    // Create stations if provided, otherwise default to Gate A, Gate B, Gate C
    const stationsToCreate = (data.stations && data.stations.length > 0)
      ? data.stations
      : [
          { name: 'Station 1', gateName: 'Gate A' },
          { name: 'Station 2', gateName: 'Gate B' },
          { name: 'Station 3', gateName: 'Gate C' },
        ];

    const createdStations = [];
    for (const st of stationsToCreate) {
      const stRes = await tx.query(
        `INSERT INTO stations (event_id, name, gate_name, created_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING *`,
        [event.id, st.name, st.gateName]
      );
      createdStations.push(stRes.rows[0]);
    }

    return {
      ...event,
      stations: createdStations,
    };
  });
}

export async function getEvents(filter?: { organizerId?: number; status?: string; publishedOnly?: boolean }) {
  const db = await getDb();
  let query = `
    SELECT 
      e.*, 
      u.name as organizer_name,
      u.email as organizer_email,
      COALESCE((SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'REGISTERED'), 0)::int as registered_count,
      COALESCE((SELECT COUNT(*) FROM check_ins c WHERE c.event_id = e.id), 0)::int as checked_in_count,
      COALESCE((SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'WAITLISTED'), 0)::int as waitlisted_count,
      COALESCE((SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status != 'CANCELLED'), 0)::int as total_registrations
    FROM events e
    JOIN users u ON u.id = e.organizer_id
  `;

  const conditions: string[] = [];
  const params: any[] = [];

  if (filter?.organizerId) {
    params.push(filter.organizerId);
    conditions.push(`e.organizer_id = $${params.length}`);
  }

  if (filter?.publishedOnly) {
    conditions.push(`e.status IN ('PUBLISHED', 'ONGOING')`);
  } else if (filter?.status) {
    params.push(filter.status);
    conditions.push(`e.status = $${params.length}`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY e.start_time ASC';

  const res = await db.query(query, params);
  return res.rows;
}

export async function getEventById(eventId: number) {
  const db = await getDb();
  const res = await db.query(
    `SELECT 
       e.*,
       u.name as organizer_name,
       u.email as organizer_email,
       COALESCE((SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'REGISTERED'), 0)::int as registered_count,
       COALESCE((SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'CHECKED_IN'), 0)::int as checked_in_count,
       COALESCE((SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'WAITLISTED'), 0)::int as waitlisted_count,
       COALESCE((SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'CANCELLED'), 0)::int as cancelled_count
     FROM events e
     JOIN users u ON u.id = e.organizer_id
     WHERE e.id = $1`,
    [eventId]
  );

  if (res.rowCount === 0) return null;

  const event = res.rows[0];
  const stationsRes = await db.query(
    `SELECT * FROM stations WHERE event_id = $1 ORDER BY gate_name ASC`,
    [eventId]
  );

  return {
    ...event,
    stations: stationsRes.rows,
  };
}

export async function updateEvent(eventId: number, organizerId: number, data: Partial<CreateEventInput>, isAdmin: boolean = false) {
  const db = await getDb();

  // Check ownership
  const existing = await db.query(`SELECT * FROM events WHERE id = $1`, [eventId]);
  if (existing.rowCount === 0) throw new Error('Event not found');
  if (existing.rows[0].organizer_id !== organizerId && !isAdmin) {
    throw new Error('Unauthorized to modify this event');
  }

  const updates: string[] = [];
  const params: any[] = [eventId];

  if (data.name) {
    params.push(data.name.trim());
    updates.push(`name = $${params.length}`);
  }
  if (data.description !== undefined) {
    params.push(data.description);
    updates.push(`description = $${params.length}`);
  }
  if (data.location) {
    params.push(data.location.trim());
    updates.push(`location = $${params.length}`);
  }
  if (data.startTime) {
    params.push(new Date(data.startTime));
    updates.push(`start_time = $${params.length}`);
  }
  if (data.endTime) {
    params.push(new Date(data.endTime));
    updates.push(`end_time = $${params.length}`);
  }
  if (data.capacity) {
    params.push(data.capacity);
    updates.push(`capacity = $${params.length}`);
  }
  if (data.status) {
    params.push(data.status);
    updates.push(`status = $${params.length}`);
  }

  updates.push(`updated_at = NOW()`);

  const query = `UPDATE events SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
  const res = await db.query(query, params);
  return res.rows[0];
}

export async function getEventStations(eventId: number) {
  const db = await getDb();
  const res = await db.query(
    `SELECT * FROM stations WHERE event_id = $1 ORDER BY gate_name ASC`,
    [eventId]
  );
  return res.rows;
}
