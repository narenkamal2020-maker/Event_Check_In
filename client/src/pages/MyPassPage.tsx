import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QrCode, RefreshCw, CheckCircle, MapPin, Calendar, Clock, Shield, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { registrationsApi, type PassData } from '../services/api';
import Navbar from '../components/Navbar';

export default function MyPassPage() {
  const { registrationId } = useParams<{ registrationId: string }>();
  const [pass, setPass] = useState<PassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPass = useCallback(async () => {
    if (!registrationId) return;
    try {
      const data = await registrationsApi.getPass(parseInt(registrationId));
      setPass(data);
      setSecondsLeft(data.expiresInSeconds);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Could not load pass');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [registrationId]);

  useEffect(() => { fetchPass(); }, [fetchPass]);

  // Countdown timer
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          fetchPass(); // Auto-refresh when token expires
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft, fetchPass]);

  const pct = pass ? Math.max(0, (secondsLeft / pass.expiresInSeconds) * 100) : 100;
  const timerColor = pct > 50 ? '#10B981' : pct > 20 ? '#FBBF24' : '#EF4444';

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPass();
  };

  if (loading) {
    return (
      <div className="page-container">
        <Navbar />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
          <div className="spinner" style={{ width: 48, height: 48 }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <Navbar />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', gap: 16 }}>
          <AlertCircle size={48} style={{ color: 'var(--color-error)' }} />
          <h2 style={{ fontSize: 22 }}>Could not load pass</h2>
          <p style={{ color: 'var(--color-text-muted)' }}>{error}</p>
          <Link to="/my-events" className="btn btn-secondary">Back to My Events</Link>
        </div>
      </div>
    );
  }

  if (!pass) return null;

  const reg = pass.registration;
  const isCheckedIn = reg.status === 'CHECKED_IN';
  const startDate = new Date(reg.event_start_time || reg.event_start || '');
  const endDate = new Date(reg.event_end_time || '');

  return (
    <div className="page-container" style={{ background: 'var(--color-bg)' }}>
      <Navbar />
      <div style={{
        marginTop: 64,
        minHeight: 'calc(100vh - 64px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 20px',
        position: 'relative',
      }}>
        {/* Background glow */}
        <div style={{
          position: 'absolute',
          width: 600, height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(13,148,136,0.08) 0%, transparent 70%)',
          top: '10%', left: '50%', transform: 'translateX(-50%)',
          pointerEvents: 'none',
        }} />

        {/* Back link */}
        <div style={{ width: '100%', maxWidth: 400, marginBottom: 20 }}>
          <Link to="/my-events" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--color-text-muted)', textDecoration: 'none' }}>
            <ArrowLeft size={16} />
            Back to My Events
          </Link>
        </div>

        {/* Pass card */}
        <div style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--color-surface-2)',
          border: `1px solid ${isCheckedIn ? 'rgba(13,148,136,0.4)' : 'rgba(13,148,136,0.25)'}`,
          borderRadius: 'var(--radius-2xl)',
          overflow: 'hidden',
          boxShadow: isCheckedIn ? '0 8px 40px rgba(13,148,136,0.18)' : '0 8px 40px rgba(13,148,136,0.1)',
          position: 'relative',
          zIndex: 1,
        }}>
          {/* Header */}
          <div style={{
            padding: '24px',
            background: isCheckedIn
              ? 'linear-gradient(135deg, rgba(13,148,136,0.12), rgba(13,148,136,0.04))'
              : 'linear-gradient(135deg, rgba(13,148,136,0.08), rgba(249,115,22,0.04))',
            borderBottom: '1px solid var(--color-border)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--color-text-muted)', marginBottom: 6 }}>
                  EVENT PASS
                </p>
                <h2 style={{ fontSize: 20, lineHeight: 1.3 }}>{reg.event_name}</h2>
              </div>
              {isCheckedIn ? (
                <div style={{
                  width: 44, height: 44,
                  borderRadius: '50%',
                  background: 'rgba(16,185,129,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid rgba(16,185,129,0.5)',
                }}>
                  <CheckCircle size={22} style={{ color: '#10B981' }} />
                </div>
              ) : (
                <div style={{
                  width: 44, height: 44,
                  borderRadius: '50%',
                  background: 'rgba(13,148,136,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid rgba(13,148,136,0.4)',
                }}>
                  <QrCode size={22} style={{ color: 'var(--color-authentic-teal)' }} />
                </div>
              )}
            </div>

            {/* Event details */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reg.event_location && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
                  <MapPin size={14} />
                  {reg.event_location}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
                <Calendar size={14} />
                {startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
                <Clock size={14} />
                {startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} – {endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          {/* QR Code area */}
          <div style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {isCheckedIn ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{
                  width: 80, height: 80,
                  borderRadius: '50%',
                  background: 'rgba(16,185,129,0.15)',
                  border: '3px solid rgba(16,185,129,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                  animation: 'bounce-in 0.5s ease',
                }}>
                  <CheckCircle size={40} style={{ color: '#10B981' }} />
                </div>
                <h3 style={{ fontSize: 22, color: '#10B981', marginBottom: 8 }}>✓ Checked In!</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                  {reg.gate_name && `via ${reg.gate_name}`}
                  {reg.checked_in_at && ` at ${new Date(reg.checked_in_at).toLocaleTimeString()}`}
                </p>
              </div>
            ) : (
              <>
                <div className="qr-wrapper" style={{ position: 'relative' }}>
                  <div className="qr-corner qr-corner-tl" />
                  <div className="qr-corner qr-corner-tr" />
                  <div className="qr-corner qr-corner-bl" />
                  <div className="qr-corner qr-corner-br" />
                  <img
                    src={pass.qrCodeDataUrl}
                    alt="QR Code"
                    style={{ width: 200, height: 200, display: 'block' }}
                    id="qr-code-img"
                  />
                </div>

                {/* Timer bar */}
                <div style={{ width: '100%', marginTop: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Shield size={12} />
                      Token expires in
                    </span>
                    <span style={{ color: timerColor, fontWeight: 700, fontFamily: 'monospace', fontSize: 14 }}>
                      {secondsLeft}s
                    </span>
                  </div>
                  <div className="qr-timer-bar">
                    <div
                      className="qr-timer-fill"
                      style={{ width: `${pct}%`, backgroundColor: timerColor }}
                    />
                  </div>
                </div>

                <button
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 14, gap: 6, fontSize: 12 }}
                  onClick={handleRefresh}
                  disabled={refreshing}
                  id="refresh-qr-btn"
                >
                  {refreshing ? <Loader2 size={14} className="animate-spin-slow" /> : <RefreshCw size={14} />}
                  {refreshing ? 'Refreshing...' : 'Refresh QR'}
                </button>
              </>
            )}

            {/* Registration info */}
            <div style={{
              width: '100%',
              marginTop: 20,
              paddingTop: 20,
              borderTop: '1px dashed var(--color-border)',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
            }}>
              <div>
                <p style={{ fontSize: 11, color: 'var(--color-text-subtle)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 4 }}>
                  REG NUMBER
                </p>
                <p style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--color-authentic-teal)' }}>
                  {reg.registration_number}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 11, color: 'var(--color-text-subtle)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 4 }}>
                  ATTENDEE
                </p>
                <p style={{ fontSize: 13 }}>{reg.attendee_name}</p>
              </div>
            </div>
          </div>
        </div>

        <p style={{ marginTop: 20, fontSize: 12, color: 'var(--color-text-subtle)', textAlign: 'center', maxWidth: 340 }}>
          Keep this pass ready at the entrance. The QR code rotates every minute for security.
          Screenshots will not work.
        </p>
      </div>
    </div>
  );
}
