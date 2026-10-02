import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { QrCode, Calendar, MapPin, Clock, CheckCircle, Users, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { registrationsApi, type Registration } from '../services/api';
import { useToast } from '../context/ToastContext';
import Navbar from '../components/Navbar';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    REGISTERED: 'badge-success',
    CHECKED_IN: 'badge-primary',
    WAITLISTED: 'badge-warning',
    CANCELLED: 'badge-error',
  };
  const icons: Record<string, React.ReactNode> = {
    REGISTERED: <CheckCircle size={12} />,
    CHECKED_IN: <QrCode size={12} />,
    WAITLISTED: <Users size={12} />,
    CANCELLED: <AlertCircle size={12} />,
  };
  return (
    <span className={`badge ${map[status] || 'badge-muted'}`}>
      {icons[status]}
      {status.replace('_', ' ')}
    </span>
  );
}

export default function MyEventsPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const { toastSuccess, toastError } = useToast();

  useEffect(() => {
    const ctrl = new AbortController();
    registrationsApi.myRegistrations(ctrl.signal)
      .then(res => setRegistrations(res.registrations))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  const handleCancel = async (regId: number, eventName: string) => {
    if (!confirm(`Cancel registration for "${eventName}"?`)) return;
    setCancelling(regId);
    try {
      await registrationsApi.cancel(regId);
      toastSuccess('Registration cancelled');
      setRegistrations(prev => prev.map(r => r.id === regId ? { ...r, status: 'CANCELLED' as const } : r));
    } catch (err: any) {
      toastError(err.message || 'Cancellation failed');
    } finally {
      setCancelling(null);
    }
  };

  const active = registrations.filter(r => r.status !== 'CANCELLED');
  const cancelled = registrations.filter(r => r.status === 'CANCELLED');

  return (
    <div className="page-container">
      <Navbar />
      <div style={{ marginTop: 64, minHeight: 'calc(100vh - 64px)', padding: '40px 20px', maxWidth: 960, margin: '64px auto 0', width: '100%' }}>
        <div className="section-header">
          <div>
            <h1 style={{ fontSize: 32, marginBottom: 8 }}>My Events</h1>
            <p style={{ color: 'var(--color-text-muted)' }}>Your registrations and digital passes</p>
          </div>
          <Link to="/events" className="btn btn-primary btn-sm">
            <ArrowRight size={16} />
            Browse Events
          </Link>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
            <div className="spinner" style={{ width: 40, height: 40 }} />
          </div>
        ) : registrations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <QrCode size={56} style={{ marginBottom: 20, opacity: 0.3 }} />
            <h3 style={{ fontSize: 22, marginBottom: 12, color: 'var(--color-text-muted)' }}>No registrations yet</h3>
            <p style={{ color: 'var(--color-text-subtle)', marginBottom: 28 }}>Browse upcoming events and register to get your digital pass.</p>
            <Link to="/events" className="btn btn-primary">Explore Events</Link>
          </div>
        ) : (
          <>
            {/* Active registrations */}
            {active.length > 0 && (
              <div style={{ marginBottom: 40 }}>
                <h2 style={{ fontSize: 18, marginBottom: 16, color: 'var(--color-text-muted)' }}>
                  Active ({active.length})
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {active.map(reg => {
                    const startDate = reg.event_start ? new Date(reg.event_start) : null;
                    return (
                      <div key={reg.id} className="card" style={{ padding: 0, overflow: 'hidden' }} id={`my-reg-${reg.id}`}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr auto',
                          gap: 16,
                          padding: '20px 24px',
                          alignItems: 'center',
                        }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                              <h3 style={{ fontSize: 18 }}>{reg.event_name}</h3>
                              <StatusBadge status={reg.status} />
                              {reg.status === 'WAITLISTED' && reg.waitlist_position && (
                                <span className="badge badge-warning">Position #{reg.waitlist_position}</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                              {reg.event_location && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-muted)' }}>
                                  <MapPin size={14} />
                                  {reg.event_location}
                                </div>
                              )}
                              {startDate && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-muted)' }}>
                                  <Calendar size={14} />
                                  {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </div>
                              )}
                            </div>
                            {reg.status === 'CHECKED_IN' && reg.checked_in_at && (
                              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-success)' }}>
                                <CheckCircle size={14} />
                                Checked in {reg.gate_name ? `via ${reg.gate_name}` : ''} at {new Date(reg.checked_in_at).toLocaleTimeString()}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                            {reg.status === 'REGISTERED' && (
                              <Link
                                to={`/my-pass/${reg.id}`}
                                className="btn btn-primary btn-sm"
                                id={`view-pass-${reg.id}`}
                              >
                                <QrCode size={15} />
                                View Pass
                              </Link>
                            )}
                            {(reg.status === 'REGISTERED' || reg.status === 'WAITLISTED') && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ color: 'var(--color-error)' }}
                                onClick={() => handleCancel(reg.id, reg.event_name || '')}
                                disabled={cancelling === reg.id}
                                id={`cancel-reg-${reg.id}`}
                              >
                                {cancelling === reg.id ? <Loader2 size={14} className="animate-spin-slow" /> : null}
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cancelled registrations */}
            {cancelled.length > 0 && (
              <div>
                <h2 style={{ fontSize: 18, marginBottom: 16, color: 'var(--color-text-muted)' }}>
                  Cancelled ({cancelled.length})
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {cancelled.map(reg => (
                    <div key={reg.id} className="card" style={{ padding: '16px 20px', opacity: 0.5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{reg.event_name}</span>
                        <StatusBadge status="CANCELLED" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
