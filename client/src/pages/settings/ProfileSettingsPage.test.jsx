import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

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

let mockPlan = { id: 'professional', name: 'Professional' };
let mockCanManageStores = true;

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser })
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ showToast })
}));

vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({ canManageStores: mockCanManageStores })
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

import ProfileSettingsPage from '../../pages/settings/ProfileSettingsPage';

function renderProfile() {
  return render(
    <MemoryRouter>
      <ProfileSettingsPage />
    </MemoryRouter>
  );
}

describe('ProfileSettingsPage (unit)', () => {
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
    mockPlan = { id: 'professional', name: 'Professional' };
    mockCanManageStores = true;
    updateProfile.mockResolvedValue({
      data: {
        user: {
          name: 'Ada Updated',
          phone: '+237611111111',
          preferredCurrency: 'USD'
        }
      }
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders profile heading, description, and personal fields', () => {
    renderProfile();

    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(
      screen.getByText('Update your personal details and display preferences.')
    ).toBeInTheDocument();

    const email = screen.getByLabelText('Email');
    expect(email).toHaveValue('owner@cargotrader.app');
    expect(email).toBeDisabled();

    expect(screen.getByLabelText('Full name')).toHaveValue('Ada Owner');
    expect(screen.getByLabelText('Phone')).toHaveValue('+237600000000');
    expect(screen.getByLabelText('Preferred currency')).toHaveValue('XAF');
    expect(screen.getByDisplayValue('Business Owner')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  it('offers supported currency options', () => {
    renderProfile();
    const select = screen.getByLabelText('Preferred currency');
    for (const code of ['XAF', 'USD', 'EUR', 'GBP', 'NGN', 'ZAR', 'MAD', 'GHS', 'KES']) {
      expect(select.querySelector(`option[value="${code}"]`)).toBeTruthy();
    }
  });

  it('blocks save when name is only whitespace and shows an error toast', async () => {
    const user = userEvent.setup();
    renderProfile();

    const nameInput = screen.getByLabelText('Full name');
    await user.clear(nameInput);
    await user.type(nameInput, '   ');
    fireEvent.submit(nameInput.closest('form'));

    expect(showToast).toHaveBeenCalledWith('Name is required', 'error');
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('saves profile via userApi.updateProfile and persists localStorage', async () => {
    const user = userEvent.setup();
    renderProfile();

    await user.clear(screen.getByLabelText('Full name'));
    await user.type(screen.getByLabelText('Full name'), 'Ada Updated');
    await user.clear(screen.getByLabelText('Phone'));
    await user.type(screen.getByLabelText('Phone'), '+237611111111');
    await user.selectOptions(screen.getByLabelText('Preferred currency'), 'USD');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith({
        name: 'Ada Updated',
        phone: '+237611111111',
        preferredCurrency: 'USD'
      });
    });

    expect(showToast).toHaveBeenCalledWith('Profile updated', 'success');
    expect(JSON.parse(localStorage.getItem('afritrade_user')).name).toBe('Ada Updated');
    expect(localStorage.getItem('afritrade_currency')).toBe('USD');
  });

  it('shows error toast when updateProfile fails', async () => {
    updateProfile.mockRejectedValueOnce({
      response: { data: { message: 'Email conflict' } }
    });
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Email conflict', 'error');
    });
  });

  it('shows Subscription & billing for managers on paid plans', () => {
    renderProfile();
    expect(screen.getByRole('heading', { name: /Subscription & billing/i })).toBeInTheDocument();
    expect(screen.getByText(/Professional plan/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage subscription' })).toBeInTheDocument();
  });

  it('hides billing section on Free plan', () => {
    mockPlan = { id: 'free', name: 'Free' };
    renderProfile();
    expect(screen.queryByRole('heading', { name: /Subscription & billing/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage subscription' })).not.toBeInTheDocument();
  });

  it('hides billing section when user cannot manage stores', () => {
    mockCanManageStores = false;
    renderProfile();
    expect(screen.queryByRole('button', { name: 'Manage subscription' })).not.toBeInTheDocument();
  });

  it('disables Save and shows Saving… while request is in flight', async () => {
    let resolveRequest;
    updateProfile.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('button', { name: /Saving/i })).toBeDisabled();

    resolveRequest({ data: { user: { name: 'Ada Owner' } } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    });
  });
});
