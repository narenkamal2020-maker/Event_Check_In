import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Users, Clock, Search, Filter, ArrowRight, Loader2, QrCode, CheckCircle } from 'lucide-react';
import { eventsApi, registrationsApi, type Event } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Navbar from '../components/Navbar';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PUBLISHED: 'badge-success',
    ONGOING: 'badge-primary',
    DRAFT: 'badge-muted',
    COMPLETED: 'badge-info',
    CANCELLED: 'badge-error',
  };
  return <span className={`badge ${map[status] || 'badge-muted'}`}>{status}</span>;
}

function CapacityBar({ registered, capacity }: { registered: number; capacity: number }) {
  const pct = Math.min(100, Math.round((registered / capacity) * 100));
  const color = pct >= 100 ? '#EF4444' : pct >= 80 ? '#FBBF24' : '#10B981';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-muted)' }}>
        <span>{registered} / {capacity} registered</span>
        <span style={{ color }}>{pct}%</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 100 ? '#EF4444' : pct >= 80 ? 'linear-gradient(90deg,#FBBF24,#F97316)' : undefined }} />
      </div>
    </div>
  );
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [myRegEventIds, setMyRegEventIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<number | null>(null);
  const { user } = useAuth();
  const { toastSuccess, toastError } = useToast();

  useEffect(() => {
    const ctrl = new AbortController();
    eventsApi.list(ctrl.signal)
      .then(res => setEvents(res.events))
      .finally(() => setLoading(false));
    if (user?.role === 'ATTENDEE') {
      registrationsApi.myRegistrations(ctrl.signal).then(res => {
        setMyRegEventIds(new Set(res.registrations.map(r => r.event_id)));
      }).catch(() => {});
    }
    return () => ctrl.abort();
  }, [user]);

  const handleRegister = async (eventId: number) => {
    if (!user) { toastError('Please log in to register'); return; }
    setRegistering(eventId);
    try {
      const res = await registrationsApi.register(eventId);
      const status = res.registration.status;
      if (status === 'REGISTERED') toastSuccess('Successfully registered! Check your pass in My Events.');
      else if (status === 'WAITLISTED') toastSuccess(`Added to waitlist — position #${res.registration.waitlist_position}`);
      setMyRegEventIds(prev => new Set([...prev, eventId]));
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, registered_count: e.registered_count + 1 } : e));
    } catch (err: any) {
      toastError(err.message || 'Registration failed');
    } finally {
      setRegistering(null);
    }
  };

  const filtered = events.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.location.toLowerCase().includes(search.toLowerCase());
    if (filter === 'open') return matchSearch && e.registered_count < e.capacity;
    if (filter === 'full') return matchSearch && e.registered_count >= e.capacity;
    if (filter === 'my') return matchSearch && myRegEventIds.has(e.id);
    return matchSearch;
  });

  return (
    <div className="page-container">
      <Navbar />
      <div style={{ marginTop: 64, minHeight: 'calc(100vh - 64px)', padding: '40px 20px', maxWidth: 1200, margin: '64px auto 0', width: '100%' }}>
        {/* Header */}
        <div className="section-header">
          <div>
            <h1 style={{ fontSize: 32, marginBottom: 8 }}>Discover Events</h1>
            <p style={{ color: 'var(--color-text-muted)' }}>Browse and register for upcoming events</p>
          </div>
        </div>

        {/* Search & filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 280px' }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-subtle)', pointerEvents: 'none' }} />
            <input
              id="events-search"
              type="text"
              className="input-field"
              style={{ paddingLeft: 40 }}
              placeholder="Search events..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['all', 'open', 'full', 'my'].map(f => (
              <button
                type="button"
                key={f}
                className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter(f)}
                id={`filter-${f}`}
              >
                {f === 'my' ? 'My Registrations' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
            <div className="spinner" style={{ width: 40, height: 40 }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80, color: 'var(--color-text-muted)' }}>
            <Calendar size={48} style={{ marginBottom: 16, opacity: 0.4 }} />
            <p style={{ fontSize: 18 }}>No events found</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
            {filtered.map(event => {
              const isRegistered = myRegEventIds.has(event.id);
              const isFull = event.registered_count >= event.capacity;
              const startDate = new Date(event.start_time);
              const isReg = registering === event.id;
              return (
                <div key={event.id} className="event-card" id={`event-card-${event.id}`}>
                  <div className="event-card-header">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <StatusBadge status={event.status} />
                      {isRegistered && (
                        <span className="badge badge-success">
                          <CheckCircle size={12} />
                          Registered
                        </span>
                      )}
                    </div>
                    <h3 style={{ fontSize: 20, marginBottom: 8, lineHeight: 1.3 }}>{event.name}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
                        <MapPin size={14} />
                        <span>{event.location}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
                        <Clock size={14} />
                        <span>
                          {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {' · '}
                          {startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="event-card-body">
                    <CapacityBar registered={event.registered_count} capacity={event.capacity} />

                    {event.waitlisted_count > 0 && (
                      <p style={{ fontSize: 12, color: 'var(--color-warning)', marginTop: 8 }}>
                        {event.waitlisted_count} on waitlist
                      </p>
                    )}

                    <div style={{ marginTop: 16 }}>
                      {user?.role === 'ATTENDEE' && !isRegistered && (
                        <button
                          type="button"
                          className={`btn btn-sm ${isFull ? 'btn-secondary' : 'btn-primary'}`}
                          style={{ width: '100%' }}
                          onClick={() => handleRegister(event.id)}
                          disabled={isReg}
                          id={`event-register-${event.id}`}
                        >
                          {isReg ? <Loader2 size={14} className="animate-spin-slow" /> : null}
                          {isReg ? 'Registering...' : isFull ? 'Join Waitlist' : 'Register'}
                        </button>
                      )}
                      {isRegistered && (
                        <Link
                          to="/my-events"
                          className="btn btn-secondary btn-sm"
                          style={{ width: '100%' }}
                          id={`view-my-pass-${event.id}`}
                        >
                          <QrCode size={14} />
                          Go to My Events
                        </Link>
                      )}
                    </div>
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
