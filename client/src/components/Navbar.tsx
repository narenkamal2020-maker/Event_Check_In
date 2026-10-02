import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  QrCode, Menu, X, LogOut, User, ChevronDown,
  Wifi, WifiOff, LayoutDashboard, Calendar, Shield, BarChart3
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { toastSuccess } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    toastSuccess('Signed out');
    navigate('/login');
  };

  const roleLinks = () => {
    if (!user) return [];
    const links: { to: string; label: string; icon: React.ReactNode }[] = [];
    if (user.role === 'ATTENDEE') {
      links.push({ to: '/events', label: 'Events', icon: <Calendar size={14} /> });
      links.push({ to: '/my-events', label: 'My Passes', icon: <QrCode size={14} /> });
    }
    if (user.role === 'ORGANIZER' || user.role === 'STAFF') {
      links.push({ to: '/organizer/events', label: 'Events', icon: <Calendar size={14} /> });
    }
    if (user.role === 'ADMIN') {
      links.push({ to: '/events', label: 'Events', icon: <Calendar size={14} /> });
      links.push({ to: '/organizer/events', label: 'Operations', icon: <LayoutDashboard size={14} /> });
      links.push({ to: '/admin/users', label: 'Admin', icon: <Shield size={14} /> });
    }
    return links;
  };

  const links = roleLinks();

  return (
    <nav className="navbar">
      {/* Brand */}
      <Link to="/" className="navbar-brand" style={{ marginRight: 40 }}>
        {/* EVENTRA geometric mark */}
        <div className="eventra-mark" aria-hidden="true" />
        <span>EVENTRA</span>
      </Link>

      {/* Desktop nav links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
        {links.map(l => (
          <Link
            key={l.to}
            to={l.to}
            className={`nav-link ${location.pathname.startsWith(l.to) ? 'active' : ''}`}
          >
            {l.label}
          </Link>
        ))}
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Connection indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: isOnline ? 'var(--color-success)' : 'var(--color-warning)',
        }}>
          {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span style={{ display: 'none' }} className="sm-show">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {user ? (
          <div ref={dropRef} style={{ position: 'relative' }}>
            <button
              type="button"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'transparent',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 12px 6px 8px',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                transition: 'var(--transition-fast)',
                fontFamily: 'var(--font-body)',
                fontSize: 12,
              }}
              onClick={() => setDropOpen(v => !v)}
              id="user-menu-btn"
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-strong)';
                (e.currentTarget as HTMLElement).style.color = '#fff';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
                (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)';
              }}
            >
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {user.name[0]?.toUpperCase()}
              </div>
              <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                {user.name}
              </span>
              <ChevronDown size={12} style={{ opacity: 0.5 }} />
            </button>

            {dropOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                background: 'rgba(8,8,8,0.97)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: 'var(--radius-lg)',
                padding: '8px',
                minWidth: 200,
                boxShadow: 'var(--shadow-lg)',
                zIndex: 200,
                animation: 'slideUp 0.15s ease',
                backdropFilter: 'blur(20px)',
              }}>
                <div style={{ padding: '10px 14px 12px', borderBottom: '1px solid var(--color-border)', marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{user.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-subtle)', marginTop: 2 }}>{user.email}</div>
                  <div style={{ marginTop: 8 }}>
                    <span className={`badge badge-${user.role === 'ADMIN' ? 'error' : user.role === 'ORGANIZER' ? 'primary' : user.role === 'STAFF' ? 'teal' : 'muted'}`}>
                      {user.role}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="sidebar-item"
                  onClick={handleLogout}
                  id="logout-btn"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to="/login" className="btn btn-ghost btn-sm">Sign In</Link>
            <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
          </div>
        )}
      </div>
    </nav>
  );
}
