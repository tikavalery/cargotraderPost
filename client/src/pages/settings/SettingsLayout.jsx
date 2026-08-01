import { Navigate, Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../utils/permissions';
import AppShell from '../../layout/AppShell';
import { useT } from '../../i18n/LanguageContext';

export default function SettingsLayout() {
  const t = useT();
  const { user, loading } = useAuth();
  const location = useLocation();
  const canManageUsers = user && can(user.role, 'manageUsers');
  const canViewSettings = user && can(user.role, 'viewSettings');

  if (loading) {
    return (
      <div className="content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <i className="fas fa-spinner fa-spin" /> {t('Loading…')}
      </div>
    );
  }

  if (!user || !canViewSettings) {
    return <Navigate to="/dashboard" replace />;
  }

  const onProfile = location.pathname.includes('/profile');
  const onUsers = location.pathname.includes('/users');

  return (
    <AppShell
      hideSearch
      className={onUsers ? 'app-shell--settings-users' : onProfile ? 'app-shell--settings-profile' : ''}
      breadcrumbs={[
        { label: 'CargoTrader', to: '/dashboard' },
        { label: 'Settings', to: canManageUsers ? '/settings/users' : '/settings/profile' },
        ...(onUsers
          ? [{ label: 'Users & Staff', current: true }]
          : onProfile
            ? [{ label: 'Profile', current: true }]
            : [{ label: 'Settings', current: true }])
      ]}
    >
      <div className={`content settings-layout${onUsers ? ' settings-layout-users' : ''}${onProfile ? ' settings-layout-profile' : ''}`}>
        <div className="settings-nav" role="navigation" aria-label="Settings">
          {canManageUsers && (
            <NavLink to="/settings/users" className={({ isActive }) => `settings-nav-item${isActive ? ' active' : ''}`}>
              <i className="fas fa-users" /> {t('Users & Staff')}
            </NavLink>
          )}
          <NavLink to="/settings/profile" className={({ isActive }) => `settings-nav-item${isActive ? ' active' : ''}`}>
            <i className="fas fa-user" /> {t('Profile')}
          </NavLink>
          <NavLink to="/pricing" className={({ isActive }) => `settings-nav-item${isActive ? ' active' : ''}`}>
            <i className="fas fa-crown" /> {t('Pricing & Plans')}
          </NavLink>
        </div>
        <div className="settings-main">
          <Outlet />
        </div>
      </div>
    </AppShell>
  );
}
