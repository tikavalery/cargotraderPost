import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { STATIC_PLANS } from '../../constants/plans';

const syncAndReload = vi.fn();
const reload = vi.fn();
const showToast = vi.fn();
let mockCurrentPlan = {
  id: 'enterprise',
  name: 'Enterprise',
  currentPeriodEnd: '2026-08-08T00:00:00.000Z',
  cancelAtPeriodEnd: false,
  isTrialing: false,
  trialPeriodDays: 7
};

vi.mock('../../layout/AppShell', () => ({
  default: function MockAppShell({ children }) {
    return <div data-testid="app-shell">{children}</div>;
  }
}));

vi.mock('../../components/plan/PlanUpgradeBanner', () => ({
  default: () => null
}));

vi.mock('../../components/billing/ManageBillingButton', () => ({
  default: () => null
}));

vi.mock('../../hooks/usePricingStripeAutoSync', () => ({
  usePricingStripeAutoSync: () => {}
}));

vi.mock('../../hooks/useSubscriptionStripeSync', () => ({
  markStripeFlow: vi.fn()
}));

vi.mock('../../context/SubscriptionContext', () => ({
  useSubscription: () => ({
    plan: mockCurrentPlan,
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

const { selectFree, downgrade } = vi.hoisted(() => ({
  selectFree: vi.fn(),
  downgrade: vi.fn()
}));

vi.mock('../../services/subscriptionApi', () => ({
  subscriptionApi: {
    listPlans: vi.fn().mockResolvedValue({ data: { plans: [] } }),
    checkout: vi.fn(),
    createCheckoutSession: vi.fn(),
    changePlan: vi.fn(),
    selectFree: (...args) => selectFree(...args),
    downgrade: (...args) => downgrade(...args)
  }
}));

import PricingPlansPage from '../views/pricing/PricingPlansPage';

describe('PricingPlansPage Professional card (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentPlan = {
      id: 'enterprise',
      name: 'Enterprise',
      currentPeriodEnd: '2026-08-08T00:00:00.000Z',
      cancelAtPeriodEnd: false,
      isTrialing: false,
      trialPeriodDays: 7
    };
    downgrade.mockResolvedValue({ data: { message: 'Downgrade scheduled' } });
  });

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={['/pricing']}>
        <PricingPlansPage />
      </MemoryRouter>
    );
  }

  it('renders Professional card matching pricing image (popular, $19, limits, 7-day trial)', async () => {
    renderPage();
    const card = await screen.findByTestId('pricing-card-professional');

    expect(within(card).getByText('Most Popular')).toBeInTheDocument();
    expect(within(card).getByRole('heading', { name: 'Professional' })).toBeInTheDocument();
    expect(within(card).getByText(STATIC_PLANS.professional.tagline)).toBeInTheDocument();
    expect(within(card).getByText('19')).toBeInTheDocument();
    expect(within(card).getByText('Billed monthly in USD')).toBeInTheDocument();
    expect(within(card).getByText(/7-day free trial for new subscribers/i)).toBeInTheDocument();
    expect(card).toHaveTextContent('3,000 items');
    expect(card).toHaveTextContent('Up to 5 stores');
    expect(card).toHaveTextContent('6,000/month');
    expect(within(card).getByRole('button', { name: 'Downgrade to Professional' })).toBeEnabled();
    expect(within(card).getByRole('button', { name: 'Downgrade to Professional' })).toHaveClass(
      'btn-primary'
    );
  });

  it('opens downgrade confirm modal from Downgrade to Professional', async () => {
    const user = userEvent.setup();
    renderPage();
    const card = await screen.findByTestId('pricing-card-professional');

    await user.click(within(card).getByRole('button', { name: 'Downgrade to Professional' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Downgrade to Professional?')).toBeInTheDocument();
  });

  it('schedules Professional downgrade via subscriptionApi.downgrade', async () => {
    const user = userEvent.setup();
    renderPage();
    const card = await screen.findByTestId('pricing-card-professional');

    await user.click(within(card).getByRole('button', { name: 'Downgrade to Professional' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Confirm downgrade/i }));

    await waitFor(() => {
      expect(downgrade).toHaveBeenCalledWith({ planId: 'professional' });
    });
    expect(selectFree).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Downgrade scheduled', 'success');
    });
    expect(reload).toHaveBeenCalled();
  });

  it('shows Current plan when already on Professional', async () => {
    mockCurrentPlan = {
      id: 'professional',
      name: 'Professional',
      isTrialing: false,
      trialPeriodDays: 7
    };
    renderPage();
    const card = await screen.findByTestId('pricing-card-professional');
    expect(within(card).getByRole('button', { name: 'Current plan' })).toBeDisabled();
  });
});
