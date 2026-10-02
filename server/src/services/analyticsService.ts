import { getDb } from '../../../src/db/index.js';

export interface EventAnalytics {
  eventId: number;
  eventName: string;
  capacity: number;
  totalRegistered: number;
  totalCheckedIn: number;
  remainingCapacity: number;
  attendanceRate: number;
  noShowCount: number;
  noShowRate: number;
  waitlistCount: number;
  cancelledCount: number;
  suspiciousCount: number;
  peakCheckInWindow: string;
  gateStats: Array<{
    stationId: number;
    stationName: string;
    gateName: string;
    count: number;
    percentage: number;
  }>;
  timeline: Array<{
    timeWindow: string;
    checkInCount: number;
    registrationCount: number;
  }>;
  attendancePercentage?: number;
  noShowPercentage?: number;
  totalWaitlisted?: number;
  totalCancelled?: number;
  checkInVelocity?: number;
  gateBreakdowns?: Array<{
    gateId: number;
    gateName: string;
    count: number;
    percentage: number;
  }>;
  peakWindows?: Array<{ hour: string; count: number }>;
  checkIns?: any[];
}

export async function getEventStats(eventId: number): Promise<EventAnalytics> {
  const db = await getDb();

  // 1. Fetch event metadata
  const eventRes = await db.query(
    `SELECT id, name, capacity, start_time, end_time FROM events WHERE id = $1`,
    [eventId]
  );
  if (eventRes.rowCount === 0) throw new Error('Event not found');
  const event = eventRes.rows[0];

  // 2. Count registrations by status
  const regCountsRes = await db.query(
    `SELECT status, COUNT(*)::int as count 
     FROM registrations 
     WHERE event_id = $1 
     GROUP BY status`,
    [eventId]
  );

  let registeredCount = 0;
  let waitlistCount = 0;
  let cancelledCount = 0;
  let checkedInRegCount = 0;

  for (const row of regCountsRes.rows) {
    if (row.status === 'REGISTERED') registeredCount = row.count;
    else if (row.status === 'WAITLISTED') waitlistCount = row.count;
    else if (row.status === 'CANCELLED') cancelledCount = row.count;
    else if (row.status === 'CHECKED_IN') checkedInRegCount = row.count;
  }

  // 3. Count check-ins
  const checkInsRes = await db.query(
    `SELECT COUNT(*)::int as count FROM check_ins WHERE event_id = $1`,
    [eventId]
  );
  const totalCheckedIn = checkInsRes.rows[0]?.count || checkedInRegCount || 0;
  const totalRegistered = registeredCount + totalCheckedIn;

  const capacity = event.capacity;
  const remainingCapacity = Math.max(0, capacity - totalRegistered);
  const attendanceRate = totalRegistered > 0 ? Number(((totalCheckedIn / totalRegistered) * 100).toFixed(1)) : 0;
  const noShowCount = Math.max(0, registeredCount);
  const noShowRate = totalRegistered > 0 ? Number(((noShowCount / totalRegistered) * 100).toFixed(1)) : 0;

  // 4. Count suspicious activities
  const suspRes = await db.query(
    `SELECT COUNT(*)::int as count FROM suspicious_activity WHERE event_id = $1`,
    [eventId]
  );
  const suspiciousCount = suspRes.rows[0]?.count || 0;

  // 5. Gate statistics
  const gateRes = await db.query(
    `SELECT 
       s.id as station_id,
       s.name as station_name,
       s.gate_name,
       COUNT(c.id)::int as count
     FROM stations s
     LEFT JOIN check_ins c ON c.station_id = s.id AND c.event_id = $1
     WHERE s.event_id = $1
     GROUP BY s.id, s.name, s.gate_name
     ORDER BY s.gate_name ASC`,
    [eventId]
  );

  const gateStats = gateRes.rows.map((g: any) => ({
    stationId: g.station_id,
    stationName: g.station_name,
    gateName: g.gate_name,
    count: g.count,
    percentage: totalCheckedIn > 0 ? Number(((g.count / totalCheckedIn) * 100).toFixed(1)) : 0,
  }));

  // 6. Check-in Timeline (Hourly)
  const timelineRes = await db.query(
    `SELECT 
       TO_CHAR(checked_in_at, 'HH24:00') as time_window,
       COUNT(*)::int as checkin_count
     FROM check_ins
     WHERE event_id = $1
     GROUP BY TO_CHAR(checked_in_at, 'HH24:00')
     ORDER BY time_window ASC`,
    [eventId]
  );

  // Find peak check-in window
  let peakCheckInWindow = 'N/A';
  let maxCheckIns = 0;
  for (const t of timelineRes.rows) {
    if (t.checkin_count > maxCheckIns) {
      maxCheckIns = t.checkin_count;
      peakCheckInWindow = `${t.time_window} (${t.checkin_count} scans)`;
    }
  }

  const timeline = timelineRes.rows.map((r: any) => ({
    timeWindow: r.time_window,
    checkInCount: r.checkin_count,
    registrationCount: 0,
  }));

  // 7. Recent Check-ins (for dashboard live feed)
  const recentCheckInsRes = await db.query(
    `SELECT c.checked_in_at, s.gate_name, u.name as attendee_name
     FROM check_ins c
     JOIN registrations r ON r.id = c.registration_id
     JOIN users u ON u.id = r.attendee_id
     LEFT JOIN stations s ON s.id = c.station_id
     WHERE c.event_id = $1
     ORDER BY c.checked_in_at DESC
     LIMIT 20`,
    [eventId]
  );

  return {
    // Core fields used by geminiService
    eventId: event.id,
    eventName: event.name,
    capacity,
    totalRegistered,
    totalCheckedIn,
    remainingCapacity,
    attendanceRate,
    noShowCount,
    noShowRate,
    waitlistCount,
    cancelledCount,
    suspiciousCount,
    peakCheckInWindow,
    gateStats,
    timeline,

    // Aliased fields expected by frontend AnalyticsData interface
    attendancePercentage: attendanceRate,
    noShowPercentage: noShowRate,
    totalWaitlisted: waitlistCount,
    totalCancelled: cancelledCount,
    checkInVelocity: totalCheckedIn,
    gateBreakdowns: gateStats.map(g => ({
      gateId: g.stationId,
      gateName: g.gateName,
      count: g.count,
      percentage: g.percentage,
    })),
    peakWindows: timeline.map(t => ({ hour: t.timeWindow, count: t.checkInCount })),
    checkIns: recentCheckInsRes.rows,
  };
}
