import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../utils/permissions';

export default function SettingsIndexRedirect() {
  const { user } = useAuth();
  if (can(user?.role, 'manageUsers')) return <Navigate to="/settings/users" replace />;
  return <Navigate to="/settings/profile" replace />;
}
