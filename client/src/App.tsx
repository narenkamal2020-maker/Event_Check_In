import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import EventsPage from './pages/EventsPage';
import MyEventsPage from './pages/MyEventsPage';
import MyPassPage from './pages/MyPassPage';
import OrganizerEventsPage from './pages/OrganizerEventsPage';
import CreateEventPage from './pages/CreateEventPage';
import OrganizerDashboardPage from './pages/OrganizerDashboardPage';
import ScannerPage from './pages/ScannerPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SuspiciousPage from './pages/SuspiciousPage';
import ExportPage from './pages/ExportPage';
import AdminUsersPage from './pages/AdminUsersPage';
import EventDetailPage from './pages/EventDetailPage';

function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--color-bg)' }}>
        <div className="spinner" style={{ width: 48, height: 48 }} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/events" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/events" element={<EventsPage />} />
      <Route path="/events/:eventId" element={<EventDetailPage />} />

      {/* Attendee */}
      <Route path="/my-events" element={
        <RequireAuth roles={['ATTENDEE', 'ADMIN']}>
          <MyEventsPage />
        </RequireAuth>
      } />
      <Route path="/my-pass/:registrationId" element={
        <RequireAuth>
          <MyPassPage />
        </RequireAuth>
      } />

      {/* Organizer / Staff / Admin */}
      <Route path="/organizer/events" element={
        <RequireAuth roles={['ORGANIZER', 'STAFF', 'ADMIN']}>
          <OrganizerEventsPage />
        </RequireAuth>
      } />
      <Route path="/organizer/events/new" element={
        <RequireAuth roles={['ORGANIZER', 'ADMIN']}>
          <CreateEventPage />
        </RequireAuth>
      } />
      <Route path="/organizer/events/:eventId/dashboard" element={
        <RequireAuth roles={['ORGANIZER', 'STAFF', 'ADMIN']}>
          <OrganizerDashboardPage />
        </RequireAuth>
      } />
      <Route path="/organizer/events/:eventId/scanner" element={
        <RequireAuth roles={['ORGANIZER', 'STAFF', 'ADMIN']}>
          <ScannerPage />
        </RequireAuth>
      } />
      <Route path="/organizer/events/:eventId/analytics" element={
        <RequireAuth roles={['ORGANIZER', 'STAFF', 'ADMIN']}>
          <AnalyticsPage />
        </RequireAuth>
      } />
      <Route path="/organizer/events/:eventId/suspicious" element={
        <RequireAuth roles={['ORGANIZER', 'ADMIN']}>
          <SuspiciousPage />
        </RequireAuth>
      } />
      <Route path="/organizer/events/:eventId/export" element={
        <RequireAuth roles={['ORGANIZER', 'ADMIN']}>
          <ExportPage />
        </RequireAuth>
      } />

      {/* Admin */}
      <Route path="/admin/users" element={
        <RequireAuth roles={['ADMIN']}>
          <AdminUsersPage />
        </RequireAuth>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
