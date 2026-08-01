import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const syncAndReload = vi.fn();
const reload = vi.fn();
const showToast = vi.fn();

vi.mock('../../layout/AppShell', () => ({
  default: function MockAppShell({ children }) {
    return <div data-testid="app-shell">{children}</div>;
  }
}));

vi.mock('../../components/plan/PlanUpgradeBanner', () => ({
  default: () => null
}));

vi.mock('../../components/billing/DowngradeConfirmModal', () => ({
  default: () => null
}));

vi.mock('../../components/billing/ManageBillingButton', () => ({
  default: function MockManageBillingButton({ label = 'Manage billing' }) {
    return <button type="button">{label}</button>;
  }
}));

vi.mock('../../hooks/usePricingStripeAutoSync', () => ({
  usePricingStripeAutoSync: () => {}
}));

vi.mock('../../hooks/useSubscriptionStripeSync', () => ({
  markStripeFlow: vi.fn()
}));

vi.mock('../../context/SubscriptionContext', () => ({
  useSubscription: () => ({
    plan: {
      id: 'enterprise',
      name: 'Enterprise',
      currentPeriodEnd: '2026-08-08T00:00:00.000Z',
      cancelAtPeriodEnd: true,
      pendingPlan: 'free',
      pendingPlanName: 'Free',
      isTrialing: false,
      trialPeriodDays: 7
    },
    reload,
    syncAndReload,
    loading: false
  })
}));

vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({ canManageStores: true })
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ showToast })
}));

vi.mock('../../services/subscriptionApi', () => ({
  subscriptionApi: {
    listPlans: vi.fn().mockResolvedValue({ data: { plans: [] } }),
    checkout: vi.fn(),
    changePlan: vi.fn(),
    downgrade: vi.fn()
  }
}));

import PricingPlansPage from '../../pages/pricing/PricingPlansPage';

describe('PricingPlansPage current-plan badge (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncAndReload.mockResolvedValue({ ok: true, message: 'Subscription synced' });
  });

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={['/pricing']}>
        <PricingPlansPage />
      </MemoryRouter>
    );
  }

  it('shows the current-plan badge with Enterprise, end date, and pending Free switch', async () => {
    renderPage();

    const badge = await screen.findByTestId('pricing-current-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Current plan');
    expect(badge).toHaveTextContent('Enterprise');
    expect(badge).toHaveTextContent('Service ends August 8, 2026');
    expect(badge).toHaveTextContent('Switching to Free at period end');
  });

  it('exposes Refresh from Stripe and Manage billing for managers on a paid plan', async () => {
    renderPage();
    const badge = await screen.findByTestId('pricing-current-badge');

    expect(badge.querySelector('.pricing-sync-link')).toBeEnabled();
    expect(badge.querySelector('.pricing-sync-link')).toHaveTextContent('Refresh from Stripe');
    expect(within(badge).getByRole('button', { name: 'Manage billing' })).toBeInTheDocument();
  });

  it('syncs from Stripe when Refresh is clicked and toasts success', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('pricing-current-badge');

    await user.click(screen.getByRole('button', { name: 'Refresh from Stripe' }));

    await waitFor(() => {
      expect(syncAndReload).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Subscription synced', 'success');
    });
  });

  it('toasts an error when Stripe sync fails', async () => {
    syncAndReload.mockResolvedValueOnce({ ok: false, message: 'Could not sync subscription' });
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('pricing-current-badge');

    await user.click(screen.getByRole('button', { name: 'Refresh from Stripe' }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Could not sync subscription');
    });
  });
});
