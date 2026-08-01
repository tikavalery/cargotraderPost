import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { can, canAny } from '../utils/permissions';

export function PermissionRoute({ permission, redirectTo = '/dashboard' }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-light)' }}>Loading…</p>
      </div>
    );
  }
  if (!can(user?.role, permission)) return <Navigate to={redirectTo} replace />;
  return <Outlet />;
}

export function PermissionAnyRoute({ permissions = [], redirectTo = '/dashboard' }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-light)' }}>Loading…</p>
      </div>
    );
  }
  if (!canAny(user?.role, permissions)) return <Navigate to={redirectTo} replace />;
  return <Outlet />;
}

export function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-light)' }}>Loading…</p>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

/** Auth pages always render — no redirect when session exists (SRS FR-01) */
export function AuthRoute() {
  return <Outlet />;
}
