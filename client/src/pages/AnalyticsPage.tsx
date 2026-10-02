import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BarChart3, Activity, Users, CheckCircle, Clock, ArrowLeft, Loader2, Sparkles, RefreshCw, Send } from 'lucide-react';
import { analyticsApi, type AnalyticsData } from '../services/api';
import Navbar from '../components/Navbar';

export default function AnalyticsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const id = parseInt(eventId || '0');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiQuestion, setAiQuestion] = useState('Give me a summary of attendance and which gate is most popular.');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiStats, setAiStats] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    analyticsApi.getStats(id, ctrl.signal)
      .then(setAnalytics)
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [id]);

  const askAi = async () => {
    if (!aiQuestion.trim()) return;
    setAiLoading(true);
    setAiAnswer('');
    try {
      const res = await analyticsApi.getAiInsight(id, aiQuestion);
      setAiAnswer(res.answer);
      setAiStats(res.verifiedStats);
    } catch (err: any) {
      setAiAnswer(`Error: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
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

  if (!analytics) return null;

  const maxBar = Math.max(...(analytics.peakWindows?.map(w => w.count) || [1]), 1);
  const noShow = analytics.totalRegistered - analytics.totalCheckedIn;

  return (
    <div className="page-container">
      <Navbar />
      <div style={{ marginTop: 64, minHeight: 'calc(100vh - 64px)', padding: '32px 20px', maxWidth: 1100, margin: '64px auto 0', width: '100%' }}>
        <Link to={`/organizer/events/${id}/dashboard`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--color-text-muted)', textDecoration: 'none', marginBottom: 20 }}>
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>

        <div className="section-header">
          <h1 style={{ fontSize: 28 }}>Analytics</h1>
          <Link to={`/organizer/events/${id}/export`} className="btn btn-secondary btn-sm" id="go-export-btn">
            Export CSV →
          </Link>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 28 }}>
          {[
            { value: analytics.totalRegistered ?? 0, label: 'Registered', color: 'var(--color-lavender-tonic)' },
            { value: analytics.totalCheckedIn ?? 0, label: 'Checked In', color: 'var(--color-authentic-teal)' },
            { value: `${isNaN(analytics.attendancePercentage) || analytics.attendancePercentage == null ? (analytics.capacity > 0 ? Math.round(((analytics.totalCheckedIn ?? 0) / analytics.capacity) * 100) : 0) : Math.round(analytics.attendancePercentage)}%`, label: 'Attendance Rate', color: 'var(--color-royal-yellow)' },
            { value: noShow < 0 ? 0 : noShow, label: 'No-Shows', color: 'var(--color-masterpiece-red)' },
            { value: analytics.totalWaitlisted ?? 0, label: 'Waitlisted', color: 'var(--color-sidecar-yellow)' },
            { value: `${analytics.checkInVelocity ?? 0}/min`, label: 'Peak Velocity', color: 'var(--color-exotic-orange)' },
          ].map((s, i) => (
            <div key={i} className="stat-card" id={`analytics-stat-${i}`}>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color, fontFamily: 'Playfair Display, Tempting, serif' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-subtle)', marginTop: 4, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          {/* Gate Breakdown */}
          <div className="card-elevated" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={16} style={{ color: 'var(--color-primary)' }} />
              Check-Ins by Gate
            </h3>
            {analytics.gateBreakdowns?.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>No check-ins recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                 {analytics.gateBreakdowns?.map((gate, i) => (
                  <div key={i} id={`gate-bar-${i}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 14 }}>{gate.gateName}</span>
                      <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                        <strong style={{ color: 'var(--color-authentic-teal)' }}>{gate.count}</strong> ({gate.percentage}%)
                      </span>
                    </div>
                    <div className="progress-bar" style={{ height: 10 }}>
                      <div className="progress-fill" style={{ width: `${gate.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attendance Donut */}
          <div className="card-elevated" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={16} style={{ color: 'var(--color-secondary)' }} />
              Registration Breakdown
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Checked In', value: analytics.totalCheckedIn, color: 'var(--color-authentic-teal)', pct: analytics.attendancePercentage },
                { label: 'No-Show', value: noShow, color: 'var(--color-masterpiece-red)', pct: analytics.noShowPercentage },
                { label: 'Waitlisted', value: analytics.totalWaitlisted, color: 'var(--color-sidecar-yellow)', pct: analytics.capacity > 0 ? Math.round((analytics.totalWaitlisted / analytics.capacity) * 100) : 0 },
                { label: 'Cancelled', value: analytics.totalCancelled || 0, color: 'var(--color-text-subtle)', pct: 0 },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 14 }}>{item.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* Simple visual bar */}
            <div style={{ marginTop: 20, height: 12, borderRadius: 'var(--radius-full)', overflow: 'hidden', display: 'flex' }}>
              {analytics.totalRegistered > 0 && [
                { pct: (analytics.totalCheckedIn / analytics.totalRegistered) * 100, color: 'var(--color-authentic-teal)' },
                { pct: (noShow / analytics.totalRegistered) * 100, color: 'var(--color-masterpiece-red)' },
                { pct: (analytics.totalWaitlisted / analytics.totalRegistered) * 100, color: 'var(--color-sidecar-yellow)' },
              ].map((seg, i) => (
                <div key={i} style={{ width: `${seg.pct}%`, background: seg.color, minWidth: seg.pct > 0 ? 4 : 0 }} />
              ))}
            </div>
          </div>
        </div>

        {/* Peak time chart */}
        {analytics.peakWindows?.length > 0 && (
          <div className="card-elevated" style={{ padding: 24, marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={16} style={{ color: 'var(--color-primary)' }} />
              Check-In Velocity Over Time
            </h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, paddingTop: 24 }}>
              {analytics.peakWindows.map((w, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div
                    className="chart-bar"
                    data-value={w.count}
                    style={{ width: '100%', height: `${Math.max(4, (w.count / maxBar) * 80)}px` }}
                    title={`${w.hour}: ${w.count} check-ins`}
                  />
                  <span style={{ fontSize: 10, color: 'var(--color-text-subtle)', transform: 'rotate(-30deg)', transformOrigin: 'center', whiteSpace: 'nowrap' }}>
                    {w.hour}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gemini AI Insights — accented with Lavender Tonic */}
        <div className="card-elevated" style={{ padding: 28, border: '1px solid rgba(196,181,253,0.25)', background: 'rgba(196,181,253,0.04)' }}>
          <h3 style={{ fontSize: 16, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} style={{ color: 'var(--color-lavender-tonic)' }} />
            AI Event Insights
            <span className="badge badge-info" style={{ fontSize: 10 }}>Powered by Gemini</span>
          </h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
            Ask questions about your event data. Answers are grounded in verified PostgreSQL statistics.
          </p>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <textarea
              id="ai-question-input"
              className="textarea-field"
              style={{ minHeight: 60, resize: 'vertical' }}
              value={aiQuestion}
              onChange={e => setAiQuestion(e.target.value)}
              placeholder="Ask anything about your event..."
            />
            <button
              className="btn btn-primary"
              style={{ flexShrink: 0, alignSelf: 'flex-end' }}
              onClick={askAi}
              disabled={aiLoading || !aiQuestion.trim()}
              id="ai-ask-btn"
            >
              {aiLoading ? <Loader2 size={18} className="animate-spin-slow" /> : <Send size={18} />}
            </button>
          </div>

          {/* Preset questions */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {[
              'Which gate had the highest throughput?',
              'What percentage checked in vs registered?',
              'Estimate no-show rate and suggest overbooking strategy.',
              'When was the peak check-in time?',
            ].map(q => (
              <button
                key={q}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 12 }}
                onClick={() => { setAiQuestion(q); }}
              >
                {q}
              </button>
            ))}
          </div>

          {aiAnswer && (
            <div style={{
              background: 'rgba(196,181,253,0.06)',
              border: '1px solid rgba(196,181,253,0.2)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
              animation: 'slideUp 0.3s ease',
            }} id="ai-answer-box">
              {aiStats && (
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(196,181,253,0.15)' }}>
                  {[
                    { label: 'Registered', value: aiStats.totalRegistered },
                    { label: 'Checked In', value: aiStats.totalCheckedIn },
                    { label: 'Waitlisted', value: aiStats.totalWaitlisted },
                    { label: 'Attendance', value: `${aiStats.attendanceRate}%` },
                  ].map((s, i) => (
                    <div key={i} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-lavender-tonic)' }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>
                {aiAnswer}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
