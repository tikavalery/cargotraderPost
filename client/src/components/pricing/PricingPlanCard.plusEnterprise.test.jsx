import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PricingPlanCard from './PricingPlanCard';
import { STATIC_PLANS, featureDisplay, FEATURE_ROWS, displayPrice } from '../../constants/plans';

const plus = STATIC_PLANS.professional_plus;
const enterprise = STATIC_PLANS.enterprise;

describe('PricingPlanCard — Professional Plus (unit)', () => {
  it('renders name, tagline, $29/mo, monthly billing, and 7-day trial', () => {
    render(
      <PricingPlanCard
        plan={plus}
        interval="month"
        trialDays={7}
        canManageStores
        buttonLabel="Downgrade to Professional Plus"
        onChoose={vi.fn()}
      />
    );

    const card = screen.getByTestId('pricing-card-professional_plus');
    expect(within(card).getByRole('heading', { name: 'Professional Plus' })).toBeInTheDocument();
    expect(within(card).getByText(plus.tagline)).toBeInTheDocument();
    expect(within(card).getByText('29')).toBeInTheDocument();
    expect(within(card).getByText('/mo USD')).toBeInTheDocument();
    expect(within(card).getByText('Billed monthly in USD')).toBeInTheDocument();
    expect(within(card).getByText(/7-day free trial for new subscribers/i)).toBeInTheDocument();
    expect(within(card).queryByText('Most Popular')).not.toBeInTheDocument();
  });

  it('lists Professional Plus limits (10k items, 10 warehouses/stores, 20k AI)', () => {
    render(
      <PricingPlanCard
        plan={plus}
        trialDays={7}
        canManageStores
        buttonLabel="Downgrade to Professional Plus"
      />
    );

    const card = screen.getByTestId('pricing-card-professional_plus');
    expect(card).toHaveTextContent('10,000 items');
    expect(card).toHaveTextContent('Up to 10');
    expect(card).toHaveTextContent('Up to 10 stores');
    expect(card).toHaveTextContent('20,000/month');
    expect(card).toHaveTextContent('Purchases & Sourcing');
    expect(card).toHaveTextContent('Shipping Management');
    expect(card).toHaveTextContent('Users & Staff Accounts');

    for (const key of [
      'inventoryItems',
      'warehouses',
      'purchases',
      'shipping',
      'pos',
      'staffAccounts',
      'purchaseAiFill'
    ]) {
      const row = card.querySelector(`[data-feature="${key}"]`);
      expect(row).not.toHaveClass('muted');
      expect(row.querySelector('i')).toHaveClass('fa-check');
    }
  });

  it('featureDisplay and displayPrice match Professional Plus monthly pricing', () => {
    const price = displayPrice(plus, 'month');
    expect(price.amount).toBe(29);
    expect(price.suffix).toBe('/mo USD');

    expect(featureDisplay(plus, FEATURE_ROWS.find((r) => r.key === 'inventoryItems'))).toBe(
      '10,000 items'
    );
    expect(featureDisplay(plus, FEATURE_ROWS.find((r) => r.key === 'warehouses'))).toBe('Up to 10');
    expect(featureDisplay(plus, FEATURE_ROWS.find((r) => r.key === 'pos'))).toBe('Up to 10 stores');
    expect(featureDisplay(plus, FEATURE_ROWS.find((r) => r.key === 'purchaseAiFill'))).toBe(
      '20,000/month'
    );
  });

  it('calls onChoose("professional_plus") for Downgrade to Professional Plus', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(
      <PricingPlanCard
        plan={plus}
        trialDays={7}
        canManageStores
        buttonLabel="Downgrade to Professional Plus"
        onChoose={onChoose}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Downgrade to Professional Plus' }));
    expect(onChoose).toHaveBeenCalledWith('professional_plus');
  });
});

describe('PricingPlanCard — Enterprise (unit)', () => {
  it('renders name, tagline, $49/mo, monthly billing, and 7-day trial', () => {
    render(
      <PricingPlanCard
        plan={enterprise}
        interval="month"
        trialDays={7}
        canManageStores
        isCurrent
        buttonLabel="Current plan"
        onChoose={vi.fn()}
      />
    );

    const card = screen.getByTestId('pricing-card-enterprise');
    expect(within(card).getByRole('heading', { name: 'Enterprise' })).toBeInTheDocument();
    expect(within(card).getByText(enterprise.tagline)).toBeInTheDocument();
    expect(within(card).getByText('49')).toBeInTheDocument();
    expect(within(card).getByText('/mo USD')).toBeInTheDocument();
    expect(within(card).getByText('Billed monthly in USD')).toBeInTheDocument();
    expect(within(card).getByText(/7-day free trial for new subscribers/i)).toBeInTheDocument();
    expect(card).toHaveClass('pricing-card-current');
  });

  it('lists Enterprise unlimited features', () => {
    render(
      <PricingPlanCard
        plan={enterprise}
        trialDays={7}
        canManageStores
        isCurrent
        buttonLabel="Current plan"
      />
    );

    const card = screen.getByTestId('pricing-card-enterprise');
    expect(card).toHaveTextContent('Unlimited');
    expect(card).toHaveTextContent('Purchases & Sourcing');
    expect(card).toHaveTextContent('Shipping Management');
    expect(card).toHaveTextContent('POS / Stores & Sales');
    expect(card).toHaveTextContent('Users & Staff Accounts');
    expect(card).toHaveTextContent('AI Assistants (Purchase & Expense)');

    const inventory = card.querySelector('[data-feature="inventoryItems"]');
    expect(inventory).toHaveTextContent('Unlimited');
    const warehouses = card.querySelector('[data-feature="warehouses"]');
    expect(warehouses).toHaveTextContent('Unlimited');
    const ai = card.querySelector('[data-feature="purchaseAiFill"]');
    expect(ai).toHaveTextContent('Unlimited');
    const pos = card.querySelector('[data-feature="pos"]');
    expect(pos).toHaveTextContent('POS / Stores & Sales');
  });

  it('featureDisplay and displayPrice match Enterprise monthly pricing', () => {
    const price = displayPrice(enterprise, 'month');
    expect(price.amount).toBe(49);
    expect(price.suffix).toBe('/mo USD');

    expect(featureDisplay(enterprise, FEATURE_ROWS.find((r) => r.key === 'inventoryItems'))).toBe(
      'Unlimited'
    );
    expect(featureDisplay(enterprise, FEATURE_ROWS.find((r) => r.key === 'warehouses'))).toBe(
      'Unlimited'
    );
    expect(featureDisplay(enterprise, FEATURE_ROWS.find((r) => r.key === 'pos'))).toBe('Included');
    expect(featureDisplay(enterprise, FEATURE_ROWS.find((r) => r.key === 'purchaseAiFill'))).toBe(
      'Unlimited'
    );
  });

  it('disables Current plan CTA when Enterprise is current', () => {
    render(
      <PricingPlanCard
        plan={enterprise}
        isCurrent
        canManageStores
        buttonLabel="Current plan"
      />
    );
    expect(screen.getByRole('button', { name: 'Current plan' })).toBeDisabled();
  });
});
