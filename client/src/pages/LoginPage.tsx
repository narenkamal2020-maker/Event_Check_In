import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@eventra.app', password: 'admin123' },
  { label: 'Organizer', email: 'organizer@eventra.app', password: 'organizer123' },
  { label: 'Staff', email: 'staff@eventra.app', password: 'staff123' },
  { label: 'Attendee', email: 'naren@example.com', password: 'password123' },
];

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState(searchParams.get('password') || '');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, user } = useAuth();
  const { toastSuccess } = useToast();
  const navigate = useNavigate();

  // Auto-login if prefilled from URL
  useEffect(() => {
    if (searchParams.get('email') && searchParams.get('password')) {
      handleSubmit(new Event('submit') as any);
    }
  }, []);

  useEffect(() => {
    if (user) redirectByRole(user.role);
  }, [user]);

  function redirectByRole(role: string) {
    if (role === 'ADMIN') navigate('/admin/users');
    else if (role === 'ORGANIZER' || role === 'STAFF') navigate('/organizer/events');
    else navigate('/events');
  }

  const handleSubmit = async (e: React.FormEvent | Event) => {
    if ('preventDefault' in e) e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      toastSuccess('Welcome back.');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (acc: typeof DEMO_ACCOUNTS[0]) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setError('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      background: '#000',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Left — editorial hero */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px 56px',
        position: 'relative',
        overflow: 'hidden',
        borderRight: '1px solid var(--color-border)',
      }}>
        {/* Grid background */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 30% 50%, black 0%, transparent 75%)',
        }} />

        {/* Glow */}
        <div style={{
          position: 'absolute', width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)',
          top: '20%', left: '-10%', pointerEvents: 'none',
        }} />

        {/* Brand */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', position: 'relative', zIndex: 1 }}>
          <div className="eventra-mark" />
          <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#fff' }}>
            EVENTRA
          </span>
        </Link>

        {/* Big editorial text */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            fontSize: 'clamp(52px, 8vw, 96px)',
            fontWeight: 900,
            lineHeight: 0.95,
            letterSpacing: '-0.04em',
            textTransform: 'uppercase',
            color: '#FFFFFF',
            marginBottom: 8,
          }}>
            CONTROL
          </div>
          <div style={{
            fontSize: 'clamp(52px, 8vw, 96px)',
            fontWeight: 900,
            lineHeight: 0.95,
            letterSpacing: '-0.04em',
            textTransform: 'uppercase',
            color: 'transparent',
            WebkitTextStroke: '1.5px rgba(255,255,255,0.35)',
          }}>
            THE CROWD.
          </div>
          <div style={{ marginTop: 28 }}>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.7, maxWidth: 340, fontWeight: 400 }}>
              Eventra gives you real-time visibility and control over every check-in at your events.
            </p>
          </div>
        </div>

        {/* Footer tagline */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: 11, color: 'var(--color-text-subtle)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Event Operations, Reimagined.
          </p>
        </div>
      </div>

      {/* Right — login form */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 56px',
        position: 'relative',
      }}>
        {/* Subtle glow */}
        <div style={{
          position: 'absolute', width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)',
          top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none',
        }} />

        <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1, animation: 'slideUp 0.4s ease' }}>
          {/* Header */}
          <div style={{ marginBottom: 36 }}>
            <div className="section-eyebrow" style={{ marginBottom: 12 }}>Welcome back</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>
              SIGN IN
            </h1>
            <p style={{ color: 'var(--color-text-subtle)', fontSize: 13, marginTop: 6, fontWeight: 400 }}>
              Access your Eventra account
            </p>
          </div>

          {/* Demo accounts */}
          <div style={{ marginBottom: 28 }}>
            <div className="text-label" style={{ marginBottom: 10 }}>Quick demo access</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  type="button"
                  key={acc.label}
                  className="btn btn-ghost btn-sm"
                  style={{
                    border: '1px solid var(--color-border)',
                    justifyContent: 'flex-start',
                    gap: 8,
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                  onClick={() => fillDemo(acc)}
                  id={`demo-fill-${acc.label.toLowerCase()}`}
                >
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
                  {acc.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '28px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Top light line */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
            }} />

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="email-input">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={14} style={{
                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--color-text-subtle)', pointerEvents: 'none',
                  }} />
                  <input
                    id="email-input"
                    type="email"
                    className="input-field"
                    style={{ paddingLeft: 40 }}
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password-input">Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={14} style={{
                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--color-text-subtle)', pointerEvents: 'none',
                  }} />
                  <input
                    id="password-input"
                    type={showPass ? 'text' : 'password'}
                    className="input-field"
                    style={{ paddingLeft: 40, paddingRight: 44 }}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    style={{
                      position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--color-text-subtle)', padding: 4,
                    }}
                    onClick={() => setShowPass(v => !v)}
                  >
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{
                  padding: '10px 14px',
                  background: 'var(--color-error-dim)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-error-border)',
                  fontSize: 13,
                  color: 'var(--color-error)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span>⚠</span> {error}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ width: '100%', padding: '13px', fontSize: 13 }}
                id="login-submit-btn"
              >
                {loading ? <Loader2 size={16} className="animate-spin-slow" /> : null}
                {loading ? 'SIGNING IN...' : 'SIGN IN →'}
              </button>
            </form>
          </div>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--color-text-subtle)' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, textDecoration: 'none' }}>
              Create one
            </Link>
          </p>
        </div>
      </div>

      {/* Mobile layout override */}
      <style>{`
        @media (max-width: 768px) {
          .login-grid { grid-template-columns: 1fr !important; }
          .login-left { display: none !important; }
          .login-right { padding: 32px 20px !important; }
        }
      `}</style>
    </div>
  );
}
