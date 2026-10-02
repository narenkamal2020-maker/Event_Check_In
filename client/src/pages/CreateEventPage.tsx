import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Minus, ArrowLeft, Loader2, Calendar, MapPin, Users, Clock } from 'lucide-react';
import { eventsApi, type CreateEventPayload } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Navbar from '../components/Navbar';

interface GateEntry { name: string; gateName: string; }

export default function CreateEventPage() {
  const { user } = useAuth();
  const { toastSuccess, toastError } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [capacity, setCapacity] = useState(100);
  const [status, setStatus] = useState('PUBLISHED');
  const [gates, setGates] = useState<GateEntry[]>([
    { name: 'Main Entrance', gateName: 'Gate A' },
    { name: 'Side Entrance', gateName: 'Gate B' },
  ]);
  const [loading, setLoading] = useState(false);

  const addGate = () => setGates(prev => [...prev, { name: '', gateName: `Gate ${String.fromCharCode(65 + prev.length)}` }]);
  const removeGate = (i: number) => setGates(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (gates.length === 0) { toastError('Add at least one gate station'); return; }
    if (new Date(endTime) <= new Date(startTime)) { toastError('End time must be after start time'); return; }

    setLoading(true);
    try {
      const payload: CreateEventPayload = {
        name, description, location,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        capacity, status,
        stations: gates,
      };
      const res = await eventsApi.create(payload);
      toastSuccess(`Event "${name}" created successfully!`);
      navigate(`/organizer/events/${res.event.id}/dashboard`);
    } catch (err: any) {
      toastError(err.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <Navbar />
      <div style={{ marginTop: 64, minHeight: 'calc(100vh - 64px)', padding: '40px 20px', maxWidth: 800, margin: '64px auto 0', width: '100%' }}>
        {/* Back link */}
        <Link to="/organizer/events" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--color-text-muted)', textDecoration: 'none', marginBottom: 24 }}>
          <ArrowLeft size={16} />
          Back to Events
        </Link>

        <div className="section-header">
          <h1 style={{ fontSize: 30 }}>Create New Event</h1>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Basic Info */}
          <div className="card-elevated" style={{ padding: 28, marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={18} style={{ color: 'var(--color-primary)' }} />
              Event Details
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="form-group">
                <label className="form-label">Event Name *</label>
                <input
                  id="event-name-input"
                  type="text"
                  className="input-field"
                  placeholder="e.g., Eventra TechSummit 2026"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  id="event-desc-input"
                  className="textarea-field"
                  placeholder="Describe your event..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Location *</label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-subtle)', pointerEvents: 'none' }} />
                  <input
                    id="event-location-input"
                    type="text"
                    className="input-field"
                    style={{ paddingLeft: 40 }}
                    placeholder="Grand Hall, Eventra Center"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Start Date & Time *</label>
                  <div style={{ position: 'relative' }}>
                    <Clock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-subtle)', pointerEvents: 'none' }} />
                    <input
                      id="event-start-input"
                      type="datetime-local"
                      className="input-field"
                      style={{ paddingLeft: 40 }}
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">End Date & Time *</label>
                  <div style={{ position: 'relative' }}>
                    <Clock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-subtle)', pointerEvents: 'none' }} />
                    <input
                      id="event-end-input"
                      type="datetime-local"
                      className="input-field"
                      style={{ paddingLeft: 40 }}
                      value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Capacity *</label>
                  <div style={{ position: 'relative' }}>
                    <Users size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-subtle)', pointerEvents: 'none' }} />
                    <input
                      id="event-capacity-input"
                      type="number"
                      className="input-field"
                      style={{ paddingLeft: 40 }}
                      min={1}
                      value={capacity}
                      onChange={e => setCapacity(parseInt(e.target.value) || 1)}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    id="event-status-select"
                    className="select-field"
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="ONGOING">Ongoing</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Gate Stations */}
          <div className="card-elevated" style={{ padding: 28, marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--color-primary)' }}>⊞</span>
                Gate Stations
              </h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addGate} id="add-gate-btn">
                <Plus size={16} />
                Add Gate
              </button>
            </div>

            {gates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)', border: '2px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                Add at least one gate station
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {gates.map((gate, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'center' }} id={`gate-row-${i}`}>
                    <div className="form-group" style={{ margin: 0 }}>
                      {i === 0 && <label className="form-label">Station Name</label>}
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Main Entrance"
                        value={gate.name}
                        onChange={e => setGates(prev => prev.map((g, idx) => idx === i ? { ...g, name: e.target.value } : g))}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      {i === 0 && <label className="form-label">Gate Name</label>}
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Gate A"
                        value={gate.gateName}
                        onChange={e => setGates(prev => prev.map((g, idx) => idx === i ? { ...g, gateName: e.target.value } : g))}
                        required
                      />
                    </div>
                    <div style={{ marginTop: i === 0 ? 22 : 0 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--color-error)', padding: '8px' }}
                        onClick={() => removeGate(i)}
                        disabled={gates.length === 1}
                        id={`remove-gate-${i}`}
                      >
                        <Minus size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <Link to="/organizer/events" className="btn btn-secondary" style={{ flex: 1 }}>
              Cancel
            </Link>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 2 }}
              disabled={loading}
              id="create-event-submit-btn"
            >
              {loading ? <Loader2 size={18} className="animate-spin-slow" /> : <Plus size={18} />}
              {loading ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
