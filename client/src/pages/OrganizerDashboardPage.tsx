import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import {
  Users, CheckCircle, Clock, Activity, QrCode, BarChart3,
  Shield, ArrowRight, MapPin, Wifi, WifiOff, RefreshCw, Zap
} from 'lucide-react';
import { eventsApi, analyticsApi, type EventDetail, type AnalyticsData } from '../services/api';
import Navbar from '../components/Navbar';

interface LiveCheckIn {
  id: string;
  attendeeName: string;
  registrationNumber: string;
  gateName: string;
  checkedInAt: string;
}

export default function OrganizerDashboardPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [liveCheckins, setLiveCheckins] = useState<LiveCheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const id = parseInt(eventId || '0');

  const fetchData = async () => {
    try {
      const [eventRes, analyticsRes] = await Promise.all([
        eventsApi.get(id),
        analyticsApi.getStats(id),
      ]);
      setEvent(eventRes.event);
      setAnalytics(analyticsRes);
      if (analyticsRes.checkIns) {
        const recent = analyticsRes.checkIns.slice(0, 8).map((ci: any, i: number) => ({
          id: `recent-${i}`,
          attendeeName: ci.attendee_name,
          registrationNumber: '',
          gateName: ci.gate_name,
          checkedInAt: ci.checked_in_at,
        }));
        setLiveCheckins(recent);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const socket = io({ path: '/socket.io', transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('join-event', id);
    });
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('checkin:success', (data: any) => {
      setLiveCheckins(prev => [{
        id: `live-${Date.now()}`,
        attendeeName: data.attendeeName,
        registrationNumber: data.registrationNumber,
        gateName: data.gateName,
        checkedInAt: new Date().toISOString(),
      }, ...prev.slice(0, 19)]);
      setAnalytics(prev => prev ? {
        ...prev,
        totalCheckedIn: (prev.totalCheckedIn || 0) + 1,
        attendancePercentage: Math.round(((prev.totalCheckedIn + 1) / prev.capacity) * 100),
      } : prev);
    });
    socket.on('registration:created', () => {
      setAnalytics(prev => prev ? { ...prev, totalRegistered: prev.totalRegistered + 1 } : prev);
    });
    return () => { socket.disconnect(); };
  }, [id]);

  if (loading) {
    return (
      <div className="page-container">
        <Navbar />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      </div>
    );
  }

  if (!event || !analytics) return null;

  const noShowCount = analytics.totalRegistered - analytics.totalCheckedIn;
  const maxBar = Math.max(...(analytics.peakWindows?.map(w => w.count) || [1]), 1);
  const attendancePct = isNaN(analytics.attendancePercentage) || analytics.attendancePercentage == null
    ? (analytics.capacity > 0 ? Math.round(((analytics.totalCheckedIn ?? 0) / analytics.capacity) * 100) : 0)
    : Math.round(analytics.attendancePercentage);

  const statItems = [
    { value: analytics.totalCheckedIn ?? 0, label: 'CHECKED IN' },
    { value: analytics.totalRegistered ?? 0, label: 'REGISTERED' },
    { value: analytics.totalWaitlisted ?? 0, label: 'WAITLISTED' },
    { value: `${attendancePct}%`, label: 'ATTENDANCE' },
    { value: noShowCount < 0 ? 0 : noShowCount, label: 'NO-SHOWS' },
    { value: `${analytics.checkInVelocity ?? 0}/min`, label: 'VELOCITY' },
  ];

  return (
    <div className="page-container">
      <Navbar />
      <div style={{ marginTop: 64, padding: '40px 32px', maxWidth: 1400, margin: '64px auto 0', width: '100%' }}>

        {/* ── PAGE HEADER ────────────────────────────────────── */}
        <div style={{ marginBottom: 48 }}>
          <div className="section-eyebrow" style={{ marginBottom: 12 }}>Event Operations</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
            <div>
              <h1 style={{
                fontSize: 'clamp(28px, 5vw, 52px)',
                fontWeight: 900,
                letterSpacing: '-0.03em',
                textTransform: 'uppercase',
                lineHeight: 1.05,
                marginBottom: 10,
              }}>
                {event.name}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-muted)' }}>
                  <MapPin size={13} />
                  {event.location}
                </div>
                {socketConnected ? (
                  <span className="live-indicator">
                    <span className="live-dot" />
                    LIVE
                  </span>
                ) : (
                  <span className="badge badge-muted">
                    <WifiOff size={10} />
                    DISCONNECTED
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={fetchData} id="refresh-dashboard-btn">
                <RefreshCw size={13} />
                REFRESH
              </button>
              <Link to={`/organizer/events/${id}/scanner`} className="btn btn-primary btn-sm" id="open-scanner-btn">
                <QrCode size={13} />
                OPEN SCANNER
              </Link>
            </div>
          </div>
        </div>

        {/* Quick nav links */}
        <div style={{ display: 'flex', gap: 1, marginBottom: 40, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {[
            { to: `/organizer/events/${id}/analytics`, icon: <BarChart3 size={13} />, label: 'ANALYTICS' },
            { to: `/organizer/events/${id}/suspicious`, icon: <Shield size={13} />, label: 'SECURITY' },
            { to: `/organizer/events/${id}/export`, icon: <ArrowRight size={13} />, label: 'EXPORT CSV' },
          ].map(btn => (
            <Link
              key={btn.to}
              to={btn.to}
              className="btn btn-ghost"
              style={{
                flex: 1, justifyContent: 'center',
                borderRadius: 0,
                borderRight: '1px solid var(--color-border)',
                padding: '12px',
              }}
            >
              {btn.icon}
              {btn.label}
            </Link>
          ))}
        </div>

        {/* ── STAT ROW ──────────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          marginBottom: 32,
        }}>
          {statItems.map((s, i) => (
            <div
              key={i}
              className="stat-row-item"
              id={`stat-card-${i}`}
              style={{
                borderRight: i < statItems.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <div style={{
                fontSize: 'clamp(28px,4vw,44px)',
                fontWeight: 900,
                letterSpacing: '-0.04em',
                lineHeight: 1,
                color: '#FFFFFF',
                marginBottom: 8,
              }}>
                {s.value}
              </div>
              <div className="text-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── CAPACITY BAR ────────────────────────────────────── */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px 28px',
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div className="text-label">EVENT CAPACITY</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              {analytics.totalRegistered} / {analytics.capacity} registered · {analytics.capacity - analytics.totalRegistered} slots remaining
            </div>
          </div>
          <div className="progress-bar" style={{ height: 3 }}>
            <div className="progress-fill" style={{ width: `${Math.min(100, (analytics.totalRegistered / analytics.capacity) * 100)}%` }} />
          </div>
          {analytics.totalWaitlisted > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-subtle)' }}>
              + {analytics.totalWaitlisted} on waitlist
            </div>
          )}
        </div>

        {/* ── GATE BREAKDOWN + LIVE FEED ─────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 16 }}>
          {/* Gate Breakdown */}
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
          }}>
            <div className="text-label" style={{ marginBottom: 20 }}>GATE ACTIVITY</div>
            {analytics.gateBreakdowns?.length === 0 ? (
              <p style={{ color: 'var(--color-text-subtle)', fontSize: 13 }}>No check-ins yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {analytics.gateBreakdowns?.map((gate, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>{gate.gateName}</span>
                      <span style={{ fontWeight: 700, color: '#fff' }}>{gate.count}</span>
                    </div>
                    <div className="progress-bar" style={{ height: 2 }}>
                      <div className="progress-fill" style={{ width: `${gate.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Peak time bars */}
            {analytics.peakWindows?.length > 0 && (
              <>
                <div className="divider" />
                <div className="text-label" style={{ marginBottom: 16 }}>PEAK WINDOWS</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 64 }}>
                  {analytics.peakWindows.slice(0, 12).map((w, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div
                        className="chart-bar"
                        style={{ width: '100%', height: `${(w.count / maxBar) * 52}px` }}
                        data-value={w.count}
                        title={`${w.hour}: ${w.count} check-ins`}
                      />
                      <span style={{ fontSize: 8, color: 'var(--color-text-subtle)', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                        {w.hour}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Live Check-In Feed */}
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div className="text-label">CHECK-IN ACTIVITY</div>
              {socketConnected && (
                <span className="live-indicator" style={{ fontSize: 9 }}>
                  <span className="live-dot" />
                  LIVE
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 360, overflowY: 'auto' }}>
              {liveCheckins.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--color-text-subtle)' }}>
                  <Activity size={32} style={{ marginBottom: 12, opacity: 0.2 }} />
                  <div className="text-label">Awaiting check-ins...</div>
                </div>
              ) : (
                liveCheckins.map(ci => (
                  <div key={ci.id} className="checkin-feed-item" id={`feed-item-${ci.id}`}>
                    {/* Time */}
                    <div style={{ fontSize: 11, color: 'var(--color-text-subtle)', fontFamily: 'monospace', flexShrink: 0, width: 68 }}>
                      {new Date(ci.checkedInAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                    </div>
                    {/* Avatar */}
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>
                      {ci.attendeeName?.[0]?.toUpperCase() || '?'}
                    </div>
                    {/* Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ci.attendeeName}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-subtle)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        {ci.gateName}
                      </div>
                    </div>
                    <CheckCircle size={14} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
