import { useState, useEffect } from 'react';
import { Shield, Users, Loader2, CheckCircle, AlertTriangle, ChevronDown } from 'lucide-react';
import { adminApi, type User, type UserRole } from '../services/api';
import { useToast } from '../context/ToastContext';
import Navbar from '../components/Navbar';

const ROLES: UserRole[] = ['ADMIN', 'ORGANIZER', 'STAFF', 'ATTENDEE'];
const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN: 'badge-error',
  ORGANIZER: 'badge-primary',
  STAFF: 'badge-teal',
  ATTENDEE: 'badge-muted',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const { toastSuccess, toastError } = useToast();

  useEffect(() => {
    const ctrl = new AbortController();
    adminApi.listUsers(ctrl.signal)
      .then(res => setUsers(res.users))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  const handleRoleChange = async (userId: number, role: UserRole) => {
    setUpdatingId(userId);
    try {
      await adminApi.updateRole(userId, role);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
      toastSuccess(`Role updated to ${role}`);
    } catch (err: any) {
      toastError(err.message || 'Failed to update role');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (userId: number, userName: string) => {
    if (!confirm(`Delete user "${userName}"? This cannot be undone.`)) return;
    setDeletingId(userId);
    try {
      await adminApi.deleteUser(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      toastSuccess('User deleted');
    } catch (err: any) {
      toastError(err.message || 'Failed to delete user');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const counts = ROLES.map(r => ({ role: r, count: users.filter(u => u.role === r).length }));

  return (
    <div className="page-container">
      <Navbar />
      <div style={{ marginTop: 64, minHeight: 'calc(100vh - 64px)', padding: '32px 20px', maxWidth: 1200, margin: '64px auto 0', width: '100%' }}>
        <div className="section-header">
          <div>
            <h1 style={{ fontSize: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
              <Shield size={26} style={{ color: 'var(--color-masterpiece-red)' }} />
              User Management
            </h1>
            <p style={{ color: 'var(--color-text-muted)', marginTop: 6 }}>
              {users.length} total users
            </p>
          </div>
        </div>

        {/* Role summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 28 }}>
          {counts.map(({ role, count }) => (
            <div key={role} className="stat-card" id={`role-count-${role.toLowerCase()}`}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-authentic-teal)', fontFamily: 'Playfair Display, Tempting, serif' }}>{count}</div>
              <div style={{ marginTop: 6 }}>
                <span className={`badge ${ROLE_COLORS[role]}`}>{role}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ marginBottom: 20 }}>
          <input
            id="user-search"
            type="text"
            className="input-field"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 400 }}
          />
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
            <div className="spinner" style={{ width: 40, height: 40 }} />
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Change Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(user => (
                  <tr key={user.id} id={`user-row-${user.id}`}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: 'var(--gradient-primary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0,
                        }}>
                          {user.name[0]?.toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 500 }}>{user.name}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{user.email}</td>
                    <td>
                      <span className={`badge ${ROLE_COLORS[user.role]}`}>{user.role}</span>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <select
                          className="select-field"
                          style={{ maxWidth: 140, padding: '7px 32px 7px 10px', fontSize: 13 }}
                          value={user.role}
                          onChange={e => handleRoleChange(user.id, e.target.value as UserRole)}
                          disabled={updatingId === user.id}
                          id={`role-select-${user.id}`}
                        >
                          {ROLES.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        {updatingId === user.id && <Loader2 size={16} className="animate-spin-slow" style={{ color: 'var(--color-primary)' }} />}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--color-error)' }}
                        onClick={() => handleDelete(user.id, user.name)}
                        disabled={deletingId === user.id}
                        id={`delete-user-${user.id}`}
                      >
                        {deletingId === user.id ? <Loader2 size={14} className="animate-spin-slow" /> : '✕'}
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                <Users size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
                <p>No users found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
