import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const showToast = vi.fn();
const updateProfile = vi.fn();

let mockUser = {
  id: 'u1',
  email: 'owner@cargotrader.app',
  name: 'Ada Owner',
  phone: '+237600000000',
  preferredCurrency: 'XAF',
  role: 'Business Owner'
};

let mockPlan = { id: 'enterprise', name: 'Enterprise' };

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

vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({ canManageStores: true })
}));

vi.mock('../../context/SubscriptionContext', () => ({
  useSubscription: () => ({ plan: mockPlan })
}));

const setCurrency = vi.fn();

vi.mock('../../context/CurrencyContext', () => ({
  useCurrency: () => ({ currency: 'XAF', setCurrency })
}));

vi.mock('../../components/billing/ManageBillingButton', () => ({
  default: function MockManageBillingButton({ label = 'Manage subscription' }) {
    return <button type="button">{label}</button>;
  }
}));

vi.mock('../../api', () => ({
  userApi: {
    updateProfile: (...args) => updateProfile(...args)
  }
}));

import SettingsLayout from './SettingsLayout';
import ProfileSettingsPage from './ProfileSettingsPage';

function renderSettingsProfile(initial = '/settings/profile') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/settings" element={<SettingsLayout />}>
          <Route path="profile" element={<ProfileSettingsPage />} />
          <Route path="users" element={<div>Users page</div>} />
        </Route>
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route path="/pricing" element={<div>Pricing</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Settings Profile page (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockUser = {
      id: 'u1',
      email: 'owner@cargotrader.app',
      name: 'Ada Owner',
      phone: '+237600000000',
      preferredCurrency: 'XAF',
      role: 'Business Owner'
    };
    mockPlan = { id: 'enterprise', name: 'Enterprise' };
    updateProfile.mockResolvedValue({
      data: { user: { name: 'Ada Owner', phone: '+237600000000', preferredCurrency: 'EUR' } }
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders profile inside settings layout with Profile breadcrumb and nav', async () => {
    renderSettingsProfile();

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    const crumbs = screen.getByTestId('breadcrumbs');
    expect(crumbs).toHaveTextContent('Settings');
    expect(crumbs).toHaveTextContent('Profile');

    expect(screen.getByRole('link', { name: /Profile/i })).toHaveAttribute(
      'href',
      '/settings/profile'
    );
    expect(screen.getByRole('link', { name: /Users & Staff/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Pricing & Plans/i })).toHaveAttribute(
      'href',
      '/pricing'
    );

    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('owner@cargotrader.app');
  });

  it('hides Users & Staff nav for Accountant (viewSettings but not manageUsers)', async () => {
    mockUser = { ...mockUser, role: 'Accountant' };
    renderSettingsProfile();

    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Users & Staff/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Profile/i })).toBeInTheDocument();
  });

  it('redirects to dashboard when user cannot view settings', async () => {
    mockUser = { ...mockUser, role: 'Store Clerk' };
    renderSettingsProfile();
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
  });

  it('saves profile changes from the settings shell and updates currency preference', async () => {
    const user = userEvent.setup();
    renderSettingsProfile();

    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Preferred currency'), 'EUR');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith({
        name: 'Ada Owner',
        phone: '+237600000000',
        preferredCurrency: 'EUR'
      });
    });
    expect(showToast).toHaveBeenCalledWith('Profile updated', 'success');
    expect(localStorage.getItem('afritrade_currency')).toBe('EUR');
  });

  it('shows Enterprise billing management in profile for paid subscribers', async () => {
    renderSettingsProfile();
    await screen.findByRole('heading', { name: 'Profile' });

    const billingTitle = screen.getByRole('heading', { name: /Subscription & billing/i });
    const billing = billingTitle.closest('section');
    expect(billing).toBeTruthy();
    expect(within(billing).getByText(/your Enterprise plan/i)).toBeInTheDocument();
    expect(within(billing).getByRole('button', { name: 'Manage subscription' })).toBeInTheDocument();
  });
});
