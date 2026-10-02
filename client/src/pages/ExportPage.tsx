import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Download, ArrowLeft, Loader2, FileText, Filter } from 'lucide-react';
import { exportApi, type ExportFilter } from '../services/api';
import { useToast } from '../context/ToastContext';
import Navbar from '../components/Navbar';

const FILTERS: { value: ExportFilter; label: string; desc: string; icon: string }[] = [
  { value: 'all', label: 'All Attendees', desc: 'Complete list of all registrations', icon: '📋' },
  { value: 'checked_in', label: 'Checked In', desc: 'Attendees who successfully checked in', icon: '✅' },
  { value: 'not_checked_in', label: 'Not Checked In', desc: 'Registered but did not attend', icon: '❌' },
  { value: 'waitlisted', label: 'Waitlisted', desc: 'On the waiting list', icon: '⏳' },
  { value: 'cancelled', label: 'Cancelled', desc: 'Cancelled registrations', icon: '🚫' },
  { value: 'suspicious', label: 'Suspicious Activity', desc: 'Flagged security incidents', icon: '🚨' },
];

export default function ExportPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const id = parseInt(eventId || '0');
  const { toastSuccess, toastError } = useToast();
  const [downloading, setDownloading] = useState<ExportFilter | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<ExportFilter>('all');

  const handleDownload = async (filter: ExportFilter) => {
    setDownloading(filter);
    try {
      await exportApi.downloadCsv(id, filter);
      toastSuccess(`CSV exported: ${filter} attendees`);
    } catch (err: any) {
      toastError(err.message || 'Export failed');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="page-container">
      <Navbar />
      <div style={{ marginTop: 64, minHeight: 'calc(100vh - 64px)', padding: '32px 20px', maxWidth: 900, margin: '64px auto 0', width: '100%' }}>
        <Link to={`/organizer/events/${id}/dashboard`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--color-text-muted)', textDecoration: 'none', marginBottom: 20 }}>
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>

        <div className="section-header">
          <div>
            <h1 style={{ fontSize: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
              <FileText size={26} style={{ color: 'var(--color-primary)' }} />
              CSV Export
            </h1>
            <p style={{ color: 'var(--color-text-muted)', marginTop: 6 }}>
              Download filtered attendance data in RFC-4180 CSV format
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, marginBottom: 32 }}>
          {FILTERS.map(f => (
            <button
              key={f.value}
              className={`btn btn-ghost`}
              onClick={() => setSelectedFilter(f.value)}
              style={{
                height: 'auto',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '20px',
                border: `1px solid ${selectedFilter === f.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: selectedFilter === f.value ? 'rgba(108,99,255,0.08)' : 'var(--color-surface-2)',
                borderRadius: 'var(--radius-lg)',
                transition: 'all 0.2s ease',
                textAlign: 'left',
                color: 'var(--color-text)',
              }}
              id={`filter-card-${f.value}`}
            >
              <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{f.label}</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{f.desc}</div>
              {selectedFilter === f.value && (
                <div className="badge badge-primary" style={{ marginTop: 10 }}>Selected</div>
              )}
            </button>
          ))}
        </div>

        {/* CSV Preview info */}
        <div className="card-elevated" style={{ padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={16} style={{ color: 'var(--color-primary)' }} />
            CSV Columns Included
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              'Registration Number', 'Attendee Name', 'Email', 'Registration Status',
              'Registered At', 'Check-In Status', 'Checked In At', 'Check-In Station',
              'Gate Name', 'Waitlist Position', 'Registration Type',
              ...(selectedFilter === 'suspicious' ? ['Incident Type', 'Severity', 'Description', 'Resolved', 'Resolution'] : [])
            ].map(col => (
              <span key={col} className="badge badge-muted" style={{ fontSize: 11 }}>{col}</span>
            ))}
          </div>
        </div>

        {/* Download button */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => handleDownload(selectedFilter)}
            disabled={!!downloading}
            style={{ width: '100%' }}
            id="download-csv-btn"
          >
            {downloading === selectedFilter
              ? <Loader2 size={20} className="animate-spin-slow" />
              : <Download size={20} />
            }
            {downloading === selectedFilter
              ? 'Generating CSV...'
              : `Download "${FILTERS.find(f => f.value === selectedFilter)?.label}" CSV`
            }
          </button>

          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--color-text-subtle)' }}>
            All exports are RFC-4180 compliant and UTF-8 encoded.
          </p>

          {/* Quick export all */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
            {FILTERS.filter(f => f.value !== selectedFilter).map(f => (
              <button
                key={f.value}
                className="btn btn-ghost btn-sm"
                onClick={() => handleDownload(f.value)}
                disabled={!!downloading}
                id={`quick-download-${f.value}`}
              >
                {downloading === f.value ? <Loader2 size={13} className="animate-spin-slow" /> : <Download size={13} />}
                {f.icon} {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
