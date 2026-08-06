import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const showToast = vi.fn();
const reloadUsage = vi.fn();

const {
  listUsers,
  listInvitations,
  listRoles,
  deleteUser,
  revokeInvitation,
  updateUser,
  resendInvitation
} = vi.hoisted(() => ({
  listUsers: vi.fn(),
  listInvitations: vi.fn(),
  listRoles: vi.fn(),
  deleteUser: vi.fn(),
  revokeInvitation: vi.fn(),
  updateUser: vi.fn(),
  resendInvitation: vi.fn()
}));

let mockUser = {
  id: 'owner-1',
  name: 'Ada Owner',
  email: 'owner@cargotrader.app',
  role: 'Business Owner'
};

let mockUsage = {
  userLimit: 15,
  atUserLimit: false,
  reload: reloadUsage
};

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser })
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ showToast })
}));

vi.mock('../../hooks/usePlanUsage', () => ({
  usePlanUsage: () => mockUsage
}));

vi.mock('../../components/plan/UserLimitBanner', () => ({
  default: function MockUserLimitBanner() {
    return <div data-testid="user-limit-banner">Users usage banner</div>;
  }
}));

vi.mock('../../services/staffApi', () => ({
  staffApi: {
    listUsers: (...a) => listUsers(...a),
    listInvitations: (...a) => listInvitations(...a),
    listRoles: (...a) => listRoles(...a),
    deleteUser: (...a) => deleteUser(...a),
    revokeInvitation: (...a) => revokeInvitation(...a),
    updateUser: (...a) => updateUser(...a),
    updateInvitation: vi.fn(),
    resendInvitation: (...a) => resendInvitation(...a),
    invite: vi.fn()
  }
}));

vi.mock('../../components/settings/InviteUserModal', () => ({
  default: function MockInviteUserModal({ open, onClose, onInvited, atUserLimit }) {
    if (!open) return null;
    return (
      <div role="dialog" aria-label="Invite user">
        <p>{atUserLimit ? 'At limit' : 'Invite form'}</p>
        <button type="button" onClick={() => onInvited({ message: 'Invitation sent' })}>
          Send invite
        </button>
        <button type="button" onClick={onClose}>
          Close invite
        </button>
      </div>
    );
  }
}));

import UsersStaffPage from './UsersStaffPage';

const team = [
  {
    id: 'owner-1',
    name: 'Ada Owner',
    email: 'owner@cargotrader.app',
    role: 'Business Owner',
    isActive: true,
    lastLoginAt: '2026-07-01T12:00:00.000Z'
  },
  {
    id: 'clerk-1',
    name: 'Sam Clerk',
    email: 'sam@cargotrader.app',
    role: 'Store Clerk',
    assignedStoreName: 'Douala Shop',
    isActive: true
  },
  {
    id: 'viewer-1',
    name: 'Hidden Viewer',
    email: 'viewer@cargotrader.app',
    role: 'Viewer',
    isActive: true
  }
];

const invites = [
  {
    id: 'inv-1',
    email: 'new@cargotrader.app',
    role: 'Warehouse Worker',
    status: 'pending',
    expiresAt: '2099-12-31T00:00:00.000Z',
    assignedWarehousesLabel: 'Yaoundé Hub'
  },
  {
    id: 'inv-old',
    email: 'expired@cargotrader.app',
    role: 'Manager',
    status: 'pending',
    expiresAt: '2020-01-01T00:00:00.000Z'
  },
  {
    id: 'inv-viewer',
    email: 'viewer-invite@cargotrader.app',
    role: 'Viewer',
    status: 'pending',
    expiresAt: '2099-12-31T00:00:00.000Z'
  }
];

function renderPage() {
  return render(
    <MemoryRouter>
      <UsersStaffPage />
    </MemoryRouter>
  );
}

describe('UsersStaffPage (unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      id: 'owner-1',
      name: 'Ada Owner',
      email: 'owner@cargotrader.app',
      role: 'Business Owner'
    };
    mockUsage = {
      userLimit: 15,
      atUserLimit: false,
      reload: reloadUsage
    };
    listUsers.mockResolvedValue({ data: { data: team } });
    listInvitations.mockResolvedValue({ data: { data: invites } });
    listRoles.mockResolvedValue({
      data: { data: ['Manager', 'Store Clerk', 'Warehouse Worker', 'Viewer', 'Individual Seller'] }
    });
    deleteUser.mockResolvedValue({ data: { ok: true } });
    revokeInvitation.mockResolvedValue({ data: { ok: true } });
    updateUser.mockResolvedValue({ data: { ok: true } });
    resendInvitation.mockResolvedValue({ data: { message: 'Invitation resent' } });
  });

  it('shows loading state then team members and pending invites', async () => {
    renderPage();
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();

    expect(await screen.findByRole('heading', { name: /Users & Staff/i })).toBeInTheDocument();
    expect(screen.getByText(/Invite team members/i)).toBeInTheDocument();
    expect(screen.getByTestId('user-limit-banner')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /Team members \(2\)/i })).toBeInTheDocument();
    expect(screen.getByText('Ada Owner')).toBeInTheDocument();
    expect(screen.getByText('Sam Clerk')).toBeInTheDocument();
    expect(screen.queryByText('Hidden Viewer')).not.toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /Pending invitations/i })).toBeInTheDocument();
    expect(screen.getByText('new@cargotrader.app')).toBeInTheDocument();
    expect(screen.queryByText('expired@cargotrader.app')).not.toBeInTheDocument();
    expect(screen.queryByText('viewer-invite@cargotrader.app')).not.toBeInTheDocument();
  });

  it('shows assignment labels for store clerks and warehouse workers', async () => {
    renderPage();
    expect(await screen.findByText('Douala Shop')).toBeInTheDocument();
    expect(screen.getByText('Yaoundé Hub')).toBeInTheDocument();
  });

  it('opens invite modal when Invite User is clicked', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: /Team members/i });

    await user.click(screen.getByRole('button', { name: /Invite User/i }));
    expect(screen.getByRole('dialog', { name: 'Invite user' })).toBeInTheDocument();
    expect(screen.getByText('Invite form')).toBeInTheDocument();
  });

  it('disables Invite User when at plan user limit', async () => {
    mockUsage = { userLimit: 2, atUserLimit: true, reload: reloadUsage };
    renderPage();
    await screen.findByRole('heading', { name: /Team members/i });

    const inviteBtn = screen.getByRole('button', { name: /Invite User/i });
    expect(inviteBtn).toBeDisabled();
    expect(inviteBtn).toHaveAttribute(
      'title',
      'User limit reached — upgrade or remove a user to invite more'
    );
    expect(screen.queryByRole('dialog', { name: 'Invite user' })).not.toBeInTheDocument();
  });

  it('completes invite success callback and reloads staff + usage', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: /Team members/i });

    await user.click(screen.getByRole('button', { name: /Invite User/i }));
    await user.click(screen.getByRole('button', { name: 'Send invite' }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Invitation sent', 'success');
    });
    expect(reloadUsage).toHaveBeenCalled();
    expect(listUsers).toHaveBeenCalledTimes(2);
  });

  it('disables delete for the business owner and does not open remove dialog', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Ada Owner');

    const ownerRow = screen.getByText('Ada Owner').closest('tr');
    const deleteBtn = within(ownerRow).getByRole('button', { name: 'Delete' });
    expect(deleteBtn).toHaveClass('is-disabled');
    expect(deleteBtn).toHaveAttribute('title', 'Cannot remove business owner');

    await user.click(deleteBtn);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('deletes a removable team member after confirm', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Sam Clerk');

    const clerkRow = screen.getByText('Sam Clerk').closest('tr');
    await user.click(within(clerkRow).getByRole('button', { name: 'Delete' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Remove team member?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(deleteUser).toHaveBeenCalledWith('clerk-1');
    });
    expect(showToast).toHaveBeenCalledWith('User removed', 'success');
    expect(reloadUsage).toHaveBeenCalled();
  });

  it('revokes a pending invitation after confirm', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('new@cargotrader.app');

    const inviteRow = screen.getByText('new@cargotrader.app').closest('tr');
    await user.click(within(inviteRow).getByRole('button', { name: 'Delete' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Revoke invitation?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Revoke' }));

    await waitFor(() => {
      expect(revokeInvitation).toHaveBeenCalledWith('inv-1');
    });
    expect(showToast).toHaveBeenCalledWith('Invitation revoked', 'success');
  });

  it('opens view modal for a team member', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Sam Clerk');

    const clerkRow = screen.getByText('Sam Clerk').closest('tr');
    await user.click(within(clerkRow).getByRole('button', { name: 'View' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Team member')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Sam Clerk');
    expect(dialog).toHaveTextContent('sam@cargotrader.app');
  });

  it('toasts when staff list fails to load', async () => {
    listUsers.mockRejectedValueOnce({ response: { data: { message: 'Forbidden' } } });
    renderPage();
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Forbidden');
    });
  });
});
