import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { QrCode, Zap, Shield, Wifi, BarChart3, Users, CheckCircle, ArrowRight, Lock } from 'lucide-react';

const FEATURES = [
  {
    icon: <QrCode size={20} />,
    title: 'Rotating QR Passes',
    desc: 'Cryptographically secure tokens rotate every 60 seconds — defeating screenshots and replay attacks at every gate.',
  },
  {
    icon: <Zap size={20} />,
    title: 'Real-Time Dashboard',
    desc: 'Socket.IO powered live feed shows check-ins the instant they happen across all gates simultaneously.',
  },
  {
    icon: <Shield size={20} />,
    title: 'Concurrency-Safe',
    desc: 'Database-level row locking prevents double check-ins even under 100 simultaneous scan requests.',
  },
  {
    icon: <Wifi size={20} />,
    title: 'Offline-First Scanner',
    desc: 'IndexedDB queues scans locally when offline. Server-authoritative sync resolves conflicts on reconnect.',
  },
  {
    icon: <BarChart3 size={20} />,
    title: 'AI-Powered Analytics',
    desc: 'Gemini AI with verified database stats answers questions about attendance patterns in natural language.',
  },
  {
    icon: <Users size={20} />,
    title: 'Smart Waitlist',
    desc: 'Atomic waitlist promotion — when a slot opens, the next attendee is instantly promoted with a new QR pass.',
  },
];

const STATS = [
  { value: '< 50ms', label: 'Check-in latency' },
  { value: '100%', label: 'Concurrency protection' },
  { value: '60s', label: 'Token rotation cycle' },
  { value: '∞', label: 'Offline scan queue' },
];

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@eventra.app', pass: 'admin123' },
  { role: 'Organizer', email: 'organizer@eventra.app', pass: 'organizer123' },
  { role: 'Staff', email: 'staff@eventra.app', pass: 'staff123' },
  { role: 'Attendee', email: 'naren@example.com', pass: 'password123' },
];

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  // Entrance animation
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const children = Array.from(hero.children) as HTMLElement[];
    children.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(32px)';
      el.style.transition = `opacity 0.8s ease ${i * 0.12}s, transform 0.8s ease ${i * 0.12}s`;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        });
      });
    });
  }, []);

  // Cards scroll animation
  useEffect(() => {
    const cards = cardsRef.current;
    if (!cards) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const i = parseInt(el.dataset.index || '0');
            setTimeout(() => {
              el.style.opacity = '1';
              el.style.transform = 'translateY(0)';
            }, i * 80);
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.1 }
    );
    Array.from(cards.children).forEach((card, i) => {
      const el = card as HTMLElement;
      el.dataset.index = String(i);
      el.style.opacity = '0';
      el.style.transform = 'translateY(40px)';
      el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
      observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="page-container" style={{ background: '#000' }}>
      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="hero-section" id="hero">
        <div className="hero-bg" />
        <div className="hero-grid" />

        {/* Radial glow accents */}
        <div style={{
          position: 'absolute', width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 65%)',
          top: '-10%', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none',
        }} />

        <div ref={heroRef} style={{ position: 'relative', zIndex: 1, maxWidth: 900, width: '100%', margin: '0 auto' }}>
          {/* Eyebrow */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.12)',
              padding: '5px 16px', borderRadius: '999px',
            }}>
              EVENT OPERATIONS PLATFORM
            </span>
          </div>

          {/* Main hero title */}
          <h1 className="hero-title" style={{ marginBottom: 12 }}>
            EVENT
          </h1>
          <h1 className="hero-title" style={{
            marginBottom: 40,
            color: 'transparent',
            WebkitTextStroke: '1.5px rgba(255,255,255,0.5)',
          }}>
            OPERATIONS.
          </h1>

          <p className="hero-subtitle" style={{ marginBottom: 48 }}>
            Cryptographic QR passes, real-time dashboards, offline-first scanning,
            and AI-powered analytics — everything you need to run flawless events at any scale.
          </p>

          {/* CTA buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/events" className="btn btn-primary btn-xl" id="hero-explore-btn">
              EXPLORE EVENTS
              <ArrowRight size={16} />
            </Link>
            <Link to="/login" className="btn btn-secondary btn-xl" id="hero-login-btn">
              SIGN IN
            </Link>
          </div>

          {/* Stats row */}
          <div style={{
            display: 'flex', marginTop: 72, justifyContent: 'center',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            flexWrap: 'wrap',
            background: 'rgba(255,255,255,0.02)',
          }}>
            {STATS.map((s, i) => (
              <div key={i} style={{
                flex: '1 1 120px',
                padding: '24px 28px',
                textAlign: 'center',
                borderRight: i < STATS.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}>
                <div style={{
                  fontSize: 28, fontWeight: 800, color: '#fff',
                  letterSpacing: '-0.03em', lineHeight: 1,
                }}>{s.value}</div>
                <div className="text-label" style={{ marginTop: 8 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Thin rule */}
      <div style={{ width: '100%', height: '1px', background: 'var(--color-border)' }} />

      {/* ── FEATURES ──────────────────────────────────────────── */}
      <section style={{ padding: '96px 24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <div style={{ marginBottom: 64 }}>
          <div className="section-eyebrow">Core capabilities</div>
          <h2 style={{
            fontSize: 'clamp(28px,5vw,48px)', fontWeight: 800,
            letterSpacing: '-0.02em', textTransform: 'uppercase', lineHeight: 1.1,
          }}>
            ZERO COMPROMISE<br />
            <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 300 }}>ENTERPRISE GRADE</span>
          </h2>
        </div>

        <div
          ref={cardsRef}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 1,
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
          }}
        >
          {FEATURES.map((f, i) => (
            <div key={i} style={{
              padding: '36px 32px',
              borderRight: (i + 1) % 3 !== 0 ? '1px solid var(--color-border)' : 'none',
              borderBottom: i < 3 ? '1px solid var(--color-border)' : 'none',
              background: 'rgba(255,255,255,0.02)',
              transition: 'background 0.25s ease',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
            >
              <div className="feature-icon">
                {f.icon}
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, letterSpacing: '-0.01em' }}>{f.title}</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 13, lineHeight: 1.75, fontWeight: 400 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Thin rule */}
      <div style={{ height: '1px', background: 'var(--color-border)', maxWidth: 1200, margin: '0 auto', width: 'calc(100% - 48px)' }} />

      {/* ── HOW IT WORKS ──────────────────────────────────────── */}
      <section style={{ padding: '96px 24px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ marginBottom: 64 }}>
            <div className="section-eyebrow">Workflow</div>
            <h2 style={{
              fontSize: 'clamp(28px,5vw,48px)', fontWeight: 800,
              letterSpacing: '-0.02em', textTransform: 'uppercase', lineHeight: 1.1,
            }}>
              REGISTRATION<br />
              <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 300 }}>TO CHECK-IN</span>
            </h2>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 0,
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
          }}>
            {[
              { step: '01', title: 'REGISTER', desc: 'One-click registration with instant QR pass issued to your device.' },
              { step: '02', title: 'GET YOUR PASS', desc: 'Rotating QR code refreshes every 60s on your device.' },
              { step: '03', title: 'SCAN AT GATE', desc: 'Staff scanner verifies token in under 50ms at any gate.' },
              { step: '04', title: 'CHECK IN', desc: 'Real-time dashboard updates instantly for all organizers.' },
            ].map((s, i) => (
              <div key={i} style={{
                padding: '36px 28px',
                borderRight: i < 3 ? '1px solid var(--color-border)' : 'none',
                background: 'rgba(255,255,255,0.02)',
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.25)',
                  letterSpacing: '0.12em', marginBottom: 20,
                }}>STEP {s.step}</div>
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 12 }}>{s.title}</div>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 13, lineHeight: 1.7 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECURITY SECTION ──────────────────────────────────── */}
      <section style={{ padding: '96px 24px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 48, alignItems: 'start',
        }}>
          <div>
            <div className="section-eyebrow" style={{ marginBottom: 16 }}>
              Security Architecture
            </div>
            <h2 style={{
              fontSize: 'clamp(24px,4vw,40px)', fontWeight: 800,
              letterSpacing: '-0.02em', textTransform: 'uppercase', lineHeight: 1.1,
              marginBottom: 32,
            }}>
              BUILT TO BE<br />
              IMPOSSIBLE<br />
              <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 300 }}>TO CHEAT</span>
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                'SHA-256 hashed tokens stored in DB, raw token never saved',
                'SELECT FOR UPDATE prevents any race condition double check-ins',
                'HTTP-only JWT cookies prevent XSS token theft',
                'Rate limiting on auth, API, and AI insight endpoints',
                'Suspicious activity detection with severity scoring',
                'Full audit trail on every action',
              ].map((point, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <CheckCircle size={14} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 3 }} />
                  <span style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{point}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 'var(--radius-xl)',
            padding: 32,
            fontFamily: 'monospace',
            fontSize: 13,
            lineHeight: 2,
          }}>
            <div style={{ color: 'rgba(255,255,255,0.3)', marginBottom: 16, fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              CONCURRENCY TEST OUTPUT
            </div>
            <div style={{ color: 'rgba(255,255,255,0.25)' }}>$ npx tsx tests/concurrency/checkin.ts</div>
            <div style={{ marginTop: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>Requests: </span>
              <span style={{ color: '#fff' }}>100</span>
            </div>
            <div>
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>Success:  </span>
              <span style={{ color: 'var(--color-success)' }}>1</span>
            </div>
            <div>
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>Rejected: </span>
              <span style={{ color: '#fff' }}>99</span>
            </div>
            <div>
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>DB rows:  </span>
              <span style={{ color: 'var(--color-success)' }}>1</span>
            </div>
            <br />
            <div style={{ color: 'var(--color-success)', fontWeight: 700 }}>PASS ✓ Duplicate protection verified!</div>
          </div>
        </div>
      </section>

      {/* ── CTA / DEMO ────────────────────────────────────────── */}
      <section style={{ padding: '96px 24px' }}>
        <div style={{
          maxWidth: 800, margin: '0 auto', textAlign: 'center',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-2xl)',
          padding: '64px 48px',
          background: 'rgba(255,255,255,0.02)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Top gradient line */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
          }} />

          <div className="section-eyebrow" style={{ marginBottom: 16 }}>Demo Access</div>
          <h2 style={{
            fontSize: 'clamp(24px,4vw,44px)', fontWeight: 800,
            letterSpacing: '-0.02em', textTransform: 'uppercase', lineHeight: 1.1,
            marginBottom: 12,
          }}>
            READY TO<br />
            <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 300 }}>CHECK IN?</span>
          </h2>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 40, fontSize: 14, lineHeight: 1.7 }}>
            Use the demo accounts below to explore every role in the system.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 40 }}>
            {DEMO_ACCOUNTS.map(acc => (
              <Link
                key={acc.role}
                to={`/login?email=${encodeURIComponent(acc.email)}&password=${encodeURIComponent(acc.pass)}`}
                className="btn btn-secondary"
                style={{ flexDirection: 'column', gap: 4, padding: '14px', height: 'auto' }}
                id={`demo-${acc.role.toLowerCase()}-btn`}
              >
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: 700, letterSpacing: '0.1em' }}>
                  {acc.role.toUpperCase()}
                </span>
                <span style={{ fontSize: 10, color: 'var(--color-text-subtle)', fontWeight: 400 }}>{acc.email}</span>
              </Link>
            ))}
          </div>
          <Link to="/register" className="btn btn-primary btn-lg" id="cta-register-btn">
            CREATE ACCOUNT
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--color-border)',
        padding: '36px 24px',
        textAlign: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
          <div className="eventra-mark" style={{ width: 20, height: 20, borderRadius: 3 }} aria-hidden="true" />
          <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#fff' }}>
            EVENTRA
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-text-subtle)', letterSpacing: '0.04em' }}>
          Event Operations, Reimagined. · Secure QR Check-In · Real-Time Analytics · Offline-First
        </p>
      </footer>
    </div>
  );
}
