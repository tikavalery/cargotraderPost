import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PricingCurrentPlanBadge from './PricingCurrentPlanBadge';

vi.mock('../billing/ManageBillingButton', () => ({
  default: function MockManageBillingButton({ label = 'Manage billing' }) {
    return <button type="button">{label}</button>;
  }
}));

function renderBadge(props) {
  return render(
    <MemoryRouter>
      <PricingCurrentPlanBadge {...props} />
    </MemoryRouter>
  );
}

const enterpriseCanceling = {
  id: 'enterprise',
  name: 'Enterprise',
  currentPeriodEnd: '2026-08-08T00:00:00.000Z',
  cancelAtPeriodEnd: true,
  pendingPlan: 'free',
  pendingPlanName: 'Free',
  isTrialing: false
};

describe('PricingCurrentPlanBadge (unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while syncing before plan is available', () => {
    const { container } = renderBadge({ currentPlan: null, syncing: true, planLoading: false });
    expect(screen.getByText('Current plan')).toBeInTheDocument();
    expect(screen.getByText(/Updating from Stripe/i)).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('renders nothing when there is no plan and not loading', () => {
    const { container } = renderBadge({ currentPlan: null });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders Enterprise plan name, service end date, and pending Free downgrade', () => {
    renderBadge({
      currentPlan: enterpriseCanceling,
      canManageStores: true,
      onSync: vi.fn()
    });

    expect(screen.getByTestId('pricing-current-badge')).toBeInTheDocument();
    expect(screen.getByText('Current plan')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
    expect(screen.getByText('Service ends August 8, 2026')).toBeInTheDocument();
    expect(screen.getByText('Switching to Free at period end')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh from Stripe' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage billing' })).toBeInTheDocument();
  });

  it('shows Renews when cancelAtPeriodEnd is false', () => {
    renderBadge({
      currentPlan: {
        ...enterpriseCanceling,
        cancelAtPeriodEnd: false,
        pendingPlan: null,
        pendingPlanName: null
      }
    });
    expect(screen.getByText('Renews August 8, 2026')).toBeInTheDocument();
    expect(screen.queryByText(/Switching to/i)).not.toBeInTheDocument();
  });

  it('shows free trial end date when trialing', () => {
    renderBadge({
      currentPlan: {
        id: 'professional',
        name: 'Professional',
        isTrialing: true,
        currentPeriodEnd: '2026-07-28T00:00:00.000Z',
        cancelAtPeriodEnd: false
      }
    });
    expect(screen.getByText('Free trial ends July 28, 2026')).toBeInTheDocument();
    expect(screen.queryByText(/Service ends/i)).not.toBeInTheDocument();
  });

  it('hides billing actions when user cannot manage stores', () => {
    renderBadge({
      currentPlan: enterpriseCanceling,
      canManageStores: false
    });
    expect(screen.queryByRole('button', { name: 'Refresh from Stripe' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage billing' })).not.toBeInTheDocument();
  });

  it('hides Manage billing on the Free plan', () => {
    renderBadge({
      currentPlan: {
        id: 'free',
        name: 'Free',
        currentPeriodEnd: null
      },
      canManageStores: true,
      onSync: vi.fn()
    });
    expect(screen.getByRole('button', { name: 'Refresh from Stripe' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage billing' })).not.toBeInTheDocument();
  });

  it('calls onSync when Refresh from Stripe is clicked', async () => {
    const user = userEvent.setup();
    const onSync = vi.fn();
    renderBadge({
      currentPlan: enterpriseCanceling,
      canManageStores: true,
      onSync
    });
    await user.click(screen.getByRole('button', { name: 'Refresh from Stripe' }));
    expect(onSync).toHaveBeenCalledTimes(1);
  });

  it('disables Refresh while syncing and shows Syncing… label', () => {
    renderBadge({
      currentPlan: enterpriseCanceling,
      canManageStores: true,
      syncing: true,
      onSync: vi.fn()
    });
    const btn = screen.getByRole('button', { name: 'Syncing…' });
    expect(btn).toBeDisabled();
    expect(document.querySelector('.pricing-sync-inline')).toHaveTextContent(/syncing/i);
  });

  it('falls back to pendingPlan id when pendingPlanName is missing', () => {
    renderBadge({
      currentPlan: {
        ...enterpriseCanceling,
        pendingPlanName: null,
        pendingPlan: 'professional'
      }
    });
    expect(screen.getByText('Switching to professional at period end')).toBeInTheDocument();
  });
});
