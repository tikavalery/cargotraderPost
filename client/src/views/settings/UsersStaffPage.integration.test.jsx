import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const showToast = vi.fn();
const reloadUsage = vi.fn();

const { listUsers, listInvitations, listRoles, deleteUser } = vi.hoisted(() => ({
  listUsers: vi.fn(),
  listInvitations: vi.fn(),
  listRoles: vi.fn(),
  deleteUser: vi.fn()
}));

let mockUser = {
  id: 'owner-1',
  name: 'Ada Owner',
  email: 'owner@cargotrader.app',
  role: 'Business Owner'
};

vi.mock('../../layout/AppShell', () => ({
  default: function MockAppShell({ children, breadcrumbs }) {
    return (
      <div data-testid="app-shell">
        <nav data-testid="breadcrumbs">
          {(breadcrumbs || []).map((b) => (
            <span key={b.label}>{b.label}</span>
          ))}
        </nav>
        {children}
      </div>
    );
  }
}));

vi.mock('../../i18n/LanguageContext', () => ({
  useT: () => (key) => key
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, loading: false })
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ showToast })
}));

vi.mock('../../hooks/usePlanUsage', () => ({
  usePlanUsage: () => ({
    userLimit: 15,
    usersUsed: 2,
    atUserLimit: false,
    planId: 'professional',
    reload: reloadUsage
  })
}));

vi.mock('../../components/plan/UserLimitBanner', () => ({
  default: () => <div data-testid="user-limit-banner">Users: 2 / 15</div>
}));

vi.mock('../../services/staffApi', () => ({
  staffApi: {
    listUsers: (...a) => listUsers(...a),
    listInvitations: (...a) => listInvitations(...a),
    listRoles: (...a) => listRoles(...a),
    deleteUser: (...a) => deleteUser(...a),
    revokeInvitation: vi.fn(),
    updateUser: vi.fn(),
    updateInvitation: vi.fn(),
    resendInvitation: vi.fn(),
    invite: vi.fn()
  }
}));

vi.mock('../../components/settings/InviteUserModal', () => ({
  default: function MockInviteUserModal({ open, onClose, onInvited }) {
    if (!open) return null;
    return (
      <div role="dialog" aria-label="Invite user">
        <button type="button" onClick={() => onInvited({ message: 'Invitation sent' })}>
          Send invite
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    );
  }
}));

import SettingsLayout from './SettingsLayout';
import UsersStaffPage from './UsersStaffPage';

function renderUsersSettings() {
  return render(
    <MemoryRouter initialEntries={['/settings/users']}>
      <Routes>
        <Route path="/settings" element={<SettingsLayout />}>
          <Route path="users" element={<UsersStaffPage />} />
          <Route path="profile" element={<div>Profile page</div>} />
        </Route>
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route path="/pricing" element={<div>Pricing</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Settings Users & Staff page (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      id: 'owner-1',
      name: 'Ada Owner',
      email: 'owner@cargotrader.app',
      role: 'Business Owner'
    };
    listUsers.mockResolvedValue({
      data: {
        data: [
          {
            id: 'owner-1',
            name: 'Ada Owner',
            email: 'owner@cargotrader.app',
            role: 'Business Owner',
            isActive: true
          },
          {
            id: 'mgr-1',
            name: 'Mo Manager',
            email: 'mo@cargotrader.app',
            role: 'Manager',
            isActive: true
          }
        ]
      }
    });
    listInvitations.mockResolvedValue({ data: { data: [] } });
    listRoles.mockResolvedValue({
      data: { data: ['Manager', 'Store Clerk', 'Warehouse Worker', 'Accountant'] }
    });
    deleteUser.mockResolvedValue({ data: { ok: true } });
  });

  it('renders Users & Staff inside settings with breadcrumb and nav', async () => {
    renderUsersSettings();

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    const crumbs = screen.getByTestId('breadcrumbs');
    expect(crumbs).toHaveTextContent('Settings');
    expect(crumbs).toHaveTextContent('Users & Staff');

    expect(screen.getByRole('link', { name: /Users & Staff/i })).toHaveAttribute(
      'href',
      '/settings/users'
    );
    expect(screen.getByRole('link', { name: /Profile/i })).toHaveAttribute(
      'href',
      '/settings/profile'
    );

    expect(await screen.findByRole('heading', { name: /Users & Staff/i })).toBeInTheDocument();
    expect(screen.getByTestId('user-limit-banner')).toHaveTextContent('Users: 2 / 15');
    expect(screen.getByRole('heading', { name: /Team members \(2\)/i })).toBeInTheDocument();
    expect(screen.getByText('Mo Manager')).toBeInTheDocument();
  });

  it('redirects users without manageUsers away from the users page via layout access', async () => {
    mockUser = { ...mockUser, role: 'Store Clerk' };
    renderUsersSettings();
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
  });

  it('allows Accountants to open settings but not Users nav (profile only)', async () => {
    mockUser = { ...mockUser, role: 'Accountant' };
    render(
      <MemoryRouter initialEntries={['/settings/profile']}>
        <Routes>
          <Route path="/settings" element={<SettingsLayout />}>
            <Route path="users" element={<UsersStaffPage />} />
            <Route path="profile" element={<div>Profile page</div>} />
          </Route>
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Profile page')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Users & Staff/i })).not.toBeInTheDocument();
  });

  it('invites a user from the settings users page and refreshes the list', async () => {
    const user = userEvent.setup();
    renderUsersSettings();
    await screen.findByRole('heading', { name: /Team members/i });

    await user.click(screen.getByRole('button', { name: /Invite User/i }));
    expect(screen.getByRole('dialog', { name: 'Invite user' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send invite' }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Invitation sent', 'success');
    });
    expect(reloadUsage).toHaveBeenCalled();
    expect(listUsers.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('removes a manager through the confirm modal and reloads usage', async () => {
    const user = userEvent.setup();
    renderUsersSettings();
    await screen.findByText('Mo Manager');

    const row = screen.getByText('Mo Manager').closest('tr');
    await user.click(within(row).getByRole('button', { name: 'Delete' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Remove team member?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(deleteUser).toHaveBeenCalledWith('mgr-1');
    });
    expect(showToast).toHaveBeenCalledWith('User removed', 'success');
    expect(reloadUsage).toHaveBeenCalled();
  });
});
