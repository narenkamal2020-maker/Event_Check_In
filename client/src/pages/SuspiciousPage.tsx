import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Shield, CheckCircle, ArrowLeft, Loader2, AlertTriangle, XCircle } from 'lucide-react';
import { suspiciousApi, type SuspiciousIncident } from '../services/api';
import { useToast } from '../context/ToastContext';
import Navbar from '../components/Navbar';

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    LOW: 'badge-info',
    MEDIUM: 'badge-warning',
    HIGH: 'badge-error',
    CRITICAL: 'badge-error',
  };
  return <span className={`badge ${map[severity] || 'badge-muted'}`}>{severity}</span>;
}

export default function SuspiciousPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const id = parseInt(eventId || '0');
  const { toastSuccess, toastError } = useToast();
  const [incidents, setIncidents] = useState<SuspiciousIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolveModal, setResolveModal] = useState<SuspiciousIncident | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    suspiciousApi.list(id, ctrl.signal)
      .then(res => setIncidents(res.incidents))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [id]);

  const handleResolve = async () => {
    if (!resolveModal) return;
    setResolvingId(resolveModal.id);
    try {
      await suspiciousApi.resolve(resolveModal.id, resolutionNote || 'Manually resolved by organizer');
      setIncidents(prev => prev.map(i => i.id === resolveModal.id ? { ...i, is_resolved: true, resolution: resolutionNote } : i));
      toastSuccess('Incident resolved');
      setResolveModal(null);
      setResolutionNote('');
    } catch (err: any) {
      toastError(err.message || 'Failed to resolve incident');
    } finally {
      setResolvingId(null);
    }
  };

  const unresolvedCount = incidents.filter(i => !i.is_resolved).length;

  return (
    <div className="page-container">
      <Navbar />
      <div style={{ marginTop: 64, minHeight: 'calc(100vh - 64px)', padding: '32px 20px', maxWidth: 1100, margin: '64px auto 0', width: '100%' }}>
        <Link to={`/organizer/events/${id}/dashboard`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--color-text-muted)', textDecoration: 'none', marginBottom: 20 }}>
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>

        <div className="section-header">
          <div>
            <h1 style={{ fontSize: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
              <Shield size={26} style={{ color: 'var(--color-error)' }} />
              Security & Suspicious Activity
            </h1>
            <p style={{ color: 'var(--color-text-muted)', marginTop: 6 }}>
              {unresolvedCount > 0
                ? <span style={{ color: '#F87171' }}>{unresolvedCount} unresolved incident{unresolvedCount > 1 ? 's' : ''}</span>
                : <span style={{ color: '#10B981' }}>All incidents resolved ✓</span>
              }
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
            <div className="spinner" style={{ width: 40, height: 40 }} />
          </div>
        ) : incidents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <CheckCircle size={56} style={{ marginBottom: 20, color: '#10B981', opacity: 0.5 }} />
            <h3 style={{ fontSize: 22, marginBottom: 12, color: 'var(--color-text-muted)' }}>No suspicious activity detected</h3>
            <p style={{ color: 'var(--color-text-subtle)' }}>The system is monitoring all check-in patterns for anomalies.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Attendee</th>
                  <th>Severity</th>
                  <th>Description</th>
                  <th>Detected</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map(incident => (
                  <tr key={incident.id} className={`suspicious-row ${incident.is_resolved ? '' : ''}`} id={`incident-row-${incident.id}`}>
                    <td>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                        {incident.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{incident.attendee_name || '—'}</div>
                      {incident.registration_number && (
                        <div style={{ fontSize: 11, color: 'var(--color-text-subtle)', fontFamily: 'monospace' }}>
                          {incident.registration_number}
                        </div>
                      )}
                    </td>
                    <td>
                      <SeverityBadge severity={incident.severity} />
                    </td>
                    <td style={{ maxWidth: 280 }}>
                      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                        {incident.description}
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(incident.detected_at).toLocaleString()}
                    </td>
                    <td>
                      {incident.is_resolved
                        ? <span className="badge badge-success"><CheckCircle size={12} />Resolved</span>
                        : <span className="badge badge-error"><XCircle size={12} />Open</span>
                      }
                    </td>
                    <td>
                      {!incident.is_resolved && (
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => setResolveModal(incident)}
                          id={`resolve-btn-${incident.id}`}
                        >
                          Resolve
                        </button>
                      )}
                      {incident.is_resolved && incident.resolution && (
                        <span style={{ fontSize: 12, color: 'var(--color-text-subtle)', maxWidth: 120, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {incident.resolution}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Resolve Modal */}
        {resolveModal && (
          <div className="modal-backdrop" onClick={() => setResolveModal(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} id="resolve-modal">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <AlertTriangle size={22} style={{ color: 'var(--color-warning)' }} />
                <h2 style={{ fontSize: 20 }}>Resolve Incident</h2>
              </div>

              <div style={{ background: 'var(--color-surface-3)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4, fontWeight: 600 }}>
                  {resolveModal.type.replace(/_/g, ' ')} · {resolveModal.severity}
                </div>
                <div style={{ fontSize: 14 }}>{resolveModal.description}</div>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Resolution Note</label>
                <textarea
                  id="resolution-note-input"
                  className="textarea-field"
                  placeholder="Describe how this was resolved (optional)"
                  value={resolutionNote}
                  onChange={e => setResolutionNote(e.target.value)}
                  style={{ minHeight: 80 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setResolveModal(null)}>
                  Cancel
                </button>
                <button
                  className="btn btn-success"
                  style={{ flex: 2 }}
                  onClick={handleResolve}
                  disabled={!!resolvingId}
                  id="confirm-resolve-btn"
                >
                  {resolvingId ? <Loader2 size={16} className="animate-spin-slow" /> : <CheckCircle size={16} />}
                  Mark Resolved
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
