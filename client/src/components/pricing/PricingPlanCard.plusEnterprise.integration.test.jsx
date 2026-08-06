import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { STATIC_PLANS } from '../../constants/plans';

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
    syncAndReload: vi.fn(),
    loading: false
  })
}));

vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({ canManageStores: true })
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ showToast })
}));

const { selectFree, downgrade, createCheckoutSession } = vi.hoisted(() => ({
  selectFree: vi.fn(),
  downgrade: vi.fn(),
  createCheckoutSession: vi.fn()
}));

vi.mock('../../services/subscriptionApi', () => ({
  subscriptionApi: {
    listPlans: vi.fn().mockResolvedValue({ data: { plans: [] } }),
    createCheckoutSession: (...args) => createCheckoutSession(...args),
    selectFree: (...args) => selectFree(...args),
    downgrade: (...args) => downgrade(...args)
  }
}));

import PricingPlansPage from '../views/pricing/PricingPlansPage';

describe('PricingPlansPage Professional Plus + Enterprise cards (integration)', () => {
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

  it('renders Professional Plus card with $29, limits, and 7-day trial', async () => {
    renderPage();
    const card = await screen.findByTestId('pricing-card-professional_plus');

    expect(within(card).getByRole('heading', { name: 'Professional Plus' })).toBeInTheDocument();
    expect(within(card).getByText(STATIC_PLANS.professional_plus.tagline)).toBeInTheDocument();
    expect(within(card).getByText('29')).toBeInTheDocument();
    expect(within(card).getByText('Billed monthly in USD')).toBeInTheDocument();
    expect(within(card).getByText(/7-day free trial for new subscribers/i)).toBeInTheDocument();
    expect(card).toHaveTextContent('10,000 items');
    expect(card).toHaveTextContent('Up to 10 stores');
    expect(card).toHaveTextContent('20,000/month');
    expect(
      within(card).getByRole('button', { name: 'Downgrade to Professional Plus' })
    ).toBeEnabled();
  });

  it('renders Enterprise as current plan with $49 and unlimited features', async () => {
    renderPage();
    const card = await screen.findByTestId('pricing-card-enterprise');

    expect(within(card).getByRole('heading', { name: 'Enterprise' })).toBeInTheDocument();
    expect(within(card).getByText(STATIC_PLANS.enterprise.tagline)).toBeInTheDocument();
    expect(within(card).getByText('49')).toBeInTheDocument();
    expect(within(card).getByText(/7-day free trial for new subscribers/i)).toBeInTheDocument();
    expect(card.querySelector('[data-feature="inventoryItems"]')).toHaveTextContent('Unlimited');
    expect(card.querySelector('[data-feature="warehouses"]')).toHaveTextContent('Unlimited');
    expect(card.querySelector('[data-feature="purchaseAiFill"]')).toHaveTextContent('Unlimited');
    expect(card).toHaveClass('pricing-card-current');
    expect(within(card).getByRole('button', { name: 'Current plan' })).toBeDisabled();
  });

  it('both paid cards show the same 7-day trial copy', async () => {
    renderPage();
    const plus = await screen.findByTestId('pricing-card-professional_plus');
    const ent = screen.getByTestId('pricing-card-enterprise');
    expect(within(plus).getByText(/7-day free trial for new subscribers/i)).toBeInTheDocument();
    expect(within(ent).getByText(/7-day free trial for new subscribers/i)).toBeInTheDocument();
  });

  it('schedules Professional Plus downgrade via subscriptionApi.downgrade', async () => {
    const user = userEvent.setup();
    renderPage();
    const card = await screen.findByTestId('pricing-card-professional_plus');

    await user.click(within(card).getByRole('button', { name: 'Downgrade to Professional Plus' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Downgrade to Professional Plus?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /Confirm downgrade/i }));

    await waitFor(() => {
      expect(downgrade).toHaveBeenCalledWith({ planId: 'professional_plus' });
    });
    expect(selectFree).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Downgrade scheduled', 'success');
    });
    expect(reload).toHaveBeenCalled();
  });

  it('offers Upgrade to Enterprise when on Professional Plus', async () => {
    mockCurrentPlan = {
      id: 'professional_plus',
      name: 'Professional Plus',
      isTrialing: false,
      trialPeriodDays: 7
    };
    createCheckoutSession.mockResolvedValue({
      data: { mode: 'updated', message: 'Plan upgraded' }
    });

    renderPage();
    const plus = await screen.findByTestId('pricing-card-professional_plus');
    const ent = screen.getByTestId('pricing-card-enterprise');

    expect(within(plus).getByRole('button', { name: 'Current plan' })).toBeDisabled();
    expect(within(ent).getByRole('button', { name: 'Upgrade to Enterprise' })).toBeEnabled();
  });
});
