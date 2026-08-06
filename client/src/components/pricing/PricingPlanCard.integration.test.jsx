import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

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
import { STATIC_PLANS } from '../../constants/plans';

describe('PricingPlansPage Free plan card (integration)', () => {
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
    selectFree.mockResolvedValue({ data: { message: 'Downgrade scheduled' } });
    downgrade.mockResolvedValue({ data: { message: 'Downgrade scheduled' } });
  });

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={['/pricing']}>
        <PricingPlansPage />
      </MemoryRouter>
    );
  }

  it('renders the Free card with catalog limits from the image', async () => {
    renderPage();
    const card = await screen.findByTestId('pricing-card-free');

    expect(within(card).getByRole('heading', { name: 'Free' })).toBeInTheDocument();
    expect(within(card).getByText(STATIC_PLANS.free.tagline)).toBeInTheDocument();
    expect(within(card).getByText('Free forever')).toBeInTheDocument();
    expect(card).toHaveTextContent('100 items');
    expect(card).toHaveTextContent('1 warehouse');
    expect(card).toHaveTextContent('1 shipment/year');
    expect(card).toHaveTextContent('1 store');
    expect(card.querySelector('[data-feature="purchaseAiFill"]')).toHaveClass('muted');
    expect(within(card).getByRole('button', { name: 'Downgrade to Free' })).toBeEnabled();
  });

  it('opens the downgrade confirm modal when Downgrade to Free is chosen', async () => {
    const user = userEvent.setup();
    renderPage();
    const card = await screen.findByTestId('pricing-card-free');

    await user.click(within(card).getByRole('button', { name: 'Downgrade to Free' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Downgrade to Free?')).toBeInTheDocument();
  });

  it('schedules Free downgrade through selectFree after confirm', async () => {
    const user = userEvent.setup();
    renderPage();
    const card = await screen.findByTestId('pricing-card-free');

    await user.click(within(card).getByRole('button', { name: 'Downgrade to Free' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Confirm downgrade/i }));

    await waitFor(() => {
      expect(selectFree).toHaveBeenCalled();
    });
    expect(downgrade).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Downgrade scheduled', 'success');
    });
    expect(reload).toHaveBeenCalled();
  });

  it('labels Free as Current plan when already on Free', async () => {
    mockCurrentPlan = { id: 'free', name: 'Free', isTrialing: false };
    renderPage();
    const card = await screen.findByTestId('pricing-card-free');
    const btn = within(card).getByRole('button', { name: 'Current plan' });
    expect(btn).toBeDisabled();
  });
});
