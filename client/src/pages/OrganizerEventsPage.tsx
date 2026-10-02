import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Calendar, Users, BarChart3, MapPin, Clock,
  CheckCircle, ArrowRight, QrCode, Activity, Shield
} from 'lucide-react';
import { eventsApi, type EventDetail } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { color: string; label: string }> = {
    PUBLISHED: { color: 'var(--color-success)', label: 'LIVE' },
    ONGOING:   { color: 'var(--color-success)', label: 'ACTIVE' },
    DRAFT:     { color: 'var(--color-text-subtle)', label: 'DRAFT' },
    COMPLETED: { color: 'rgba(255,255,255,0.35)', label: 'ENDED' },
    CANCELLED: { color: 'var(--color-error)', label: 'CANCELLED' },
  };
  const s = styles[status] || { color: 'var(--color-text-subtle)', label: status };
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
      color: s.color, display: 'inline-flex', alignItems: 'center', gap: 5,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
      {s.label}
    </span>
  );
}

export default function OrganizerEventsPage() {
  const [events, setEvents] = useState<EventDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const ctrl = new AbortController();
    eventsApi.list(ctrl.signal)
      .then(res => {
        const myEvents = (res as any).events.filter((e: EventDetail) =>
          user?.role === 'ADMIN' || e.organizer_id === user?.id
        );
        setEvents(myEvents);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [user]);

  return (
    <div className="page-container">
      <Navbar />
      <div style={{ marginTop: 64, padding: '40px 32px', maxWidth: 1200, margin: '64px auto 0', width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 48, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="section-eyebrow" style={{ marginBottom: 10 }}>Event Operations</div>
            <h1 style={{
              fontSize: 'clamp(28px, 5vw, 52px)',
              fontWeight: 900, letterSpacing: '-0.03em',
              textTransform: 'uppercase', lineHeight: 1.05,
            }}>
              EVENT<br />
              <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 300 }}>MANAGEMENT</span>
            </h1>
          </div>
          <Link to="/organizer/events/new" className="btn btn-primary" id="create-event-btn">
            <Plus size={15} />
            CREATE EVENT
          </Link>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <div className="spinner" style={{ width: 40, height: 40 }} />
          </div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{
              width: 80, height: 80, borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
              background: 'var(--color-surface)',
            }}>
              <Calendar size={32} style={{ opacity: 0.2 }} />
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10, letterSpacing: '-0.01em' }}>No events yet</h3>
            <p style={{ color: 'var(--color-text-subtle)', marginBottom: 28, fontSize: 14 }}>Create your first event to get started.</p>
            <Link to="/organizer/events/new" className="btn btn-primary">CREATE EVENT</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 80px 80px 80px auto',
              padding: '10px 24px',
              borderBottom: '1px solid var(--color-border)',
              marginBottom: 0,
            }}>
              {['EVENT', 'DATE / LOCATION', 'CHECKED IN', 'ATTENDANCE', 'STATUS', 'ACTIONS'].map(h => (
                <div key={h} className="text-label">{h}</div>
              ))}
            </div>

            {events.map((event, idx) => {
              const startDate = new Date(event.start_time);
              const regCount = Number(event.registered_count || event.total_registrations || 0);
              const checkedCount = Number(event.checked_in_count || event.total_check_ins || 0);
              const cap = Number(event.capacity || 0);
              const checkedInPct = cap > 0 ? Math.round((checkedCount / cap) * 100) : 0;

              return (
                <div
                  key={event.id}
                  id={`organizer-event-${event.id}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 80px 80px 80px auto',
                    padding: '20px 24px',
                    borderBottom: idx < events.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    alignItems: 'center',
                    gap: 16,
                    transition: 'background 0.15s ease',
                    background: 'transparent',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Event name */}
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, letterSpacing: '-0.01em' }}>
                      {event.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-subtle)' }}>
                      {regCount}/{cap} registered
                    </div>
                  </div>

                  {/* Date / location */}
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 3 }}>
                      {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-subtle)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={10} />
                      {event.location}
                    </div>
                  </div>

                  {/* Checked in */}
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', color: '#fff' }}>
                      {checkedCount}
                    </div>
                  </div>

                  {/* Attendance */}
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: checkedInPct >= 80 ? 'var(--color-success)' : '#fff' }}>
                      {isNaN(checkedInPct) ? 0 : checkedInPct}%
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <StatusBadge status={event.status} />
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Link
                      to={`/organizer/events/${event.id}/dashboard`}
                      className="btn btn-primary btn-sm"
                      title="Dashboard"
                      id={`dashboard-btn-${event.id}`}
                    >
                      <Activity size={13} />
                    </Link>
                    <Link
                      to={`/organizer/events/${event.id}/scanner`}
                      className="btn btn-secondary btn-sm"
                      title="Scanner"
                      id={`scanner-btn-${event.id}`}
                    >
                      <QrCode size={13} />
                    </Link>
                    <Link
                      to={`/organizer/events/${event.id}/analytics`}
                      className="btn btn-secondary btn-sm"
                      title="Analytics"
                      id={`analytics-btn-${event.id}`}
                    >
                      <BarChart3 size={13} />
                    </Link>
                    <Link
                      to={`/organizer/events/${event.id}/suspicious`}
                      className="btn btn-secondary btn-sm"
                      title="Security"
                      id={`suspicious-btn-${event.id}`}
                    >
                      <Shield size={13} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
