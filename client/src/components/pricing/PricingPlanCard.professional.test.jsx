import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PricingPlanCard from './PricingPlanCard';
import { STATIC_PLANS, featureDisplay, FEATURE_ROWS, displayPrice } from '../../constants/plans';

const pro = STATIC_PLANS.professional;

describe('PricingPlanCard — Professional plan (unit)', () => {
  it('renders Most Popular badge, name, tagline, $19/mo, and monthly billing copy', () => {
    render(
      <PricingPlanCard
        plan={pro}
        interval="month"
        trialDays={7}
        canManageStores
        buttonLabel="Downgrade to Professional"
        onChoose={vi.fn()}
      />
    );

    const card = screen.getByTestId('pricing-card-professional');
    expect(within(card).getByText('Most Popular')).toBeInTheDocument();
    expect(within(card).getByRole('heading', { name: 'Professional' })).toBeInTheDocument();
    expect(within(card).getByText(pro.tagline)).toBeInTheDocument();
    expect(within(card).getByText('19')).toBeInTheDocument();
    expect(within(card).getByText('/mo USD')).toBeInTheDocument();
    expect(within(card).getByText('Billed monthly in USD')).toBeInTheDocument();
    expect(card).toHaveClass('pricing-card-popular');
  });

  it('shows 7-day free trial for new subscribers on paid plans', () => {
    render(
      <PricingPlanCard
        plan={pro}
        trialDays={7}
        canManageStores
        buttonLabel="Downgrade to Professional"
      />
    );
    const card = screen.getByTestId('pricing-card-professional');
    expect(within(card).getByText(/7-day free trial for new subscribers/i)).toBeInTheDocument();
  });

  it('lists Professional limits from the catalog (inventory, warehouses, stores, AI)', () => {
    render(
      <PricingPlanCard
        plan={pro}
        trialDays={7}
        canManageStores
        buttonLabel="Downgrade to Professional"
      />
    );

    const card = screen.getByTestId('pricing-card-professional');
    expect(card).toHaveTextContent('3,000 items');
    expect(card).toHaveTextContent('Up to 5');
    expect(card).toHaveTextContent('Purchases & Sourcing');
    expect(card).toHaveTextContent('Shipping Management');
    expect(card).toHaveTextContent('Up to 5 stores');
    expect(card).toHaveTextContent('Users & Staff Accounts');
    expect(card).toHaveTextContent('6,000/month');

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

  it('featureDisplay and displayPrice match Professional monthly pricing', () => {
    const price = displayPrice(pro, 'month');
    expect(price.amount).toBe(19);
    expect(price.suffix).toBe('/mo USD');
    expect(price.billed).toBe('Billed monthly in USD');

    expect(featureDisplay(pro, FEATURE_ROWS.find((r) => r.key === 'inventoryItems'))).toBe(
      '3,000 items'
    );
    expect(featureDisplay(pro, FEATURE_ROWS.find((r) => r.key === 'warehouses'))).toBe('Up to 5');
    expect(featureDisplay(pro, FEATURE_ROWS.find((r) => r.key === 'pos'))).toBe('Up to 5 stores');
    expect(featureDisplay(pro, FEATURE_ROWS.find((r) => r.key === 'purchaseAiFill'))).toBe(
      '6,000/month'
    );
  });

  it('calls onChoose("professional") for Downgrade to Professional', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(
      <PricingPlanCard
        plan={pro}
        trialDays={7}
        canManageStores
        buttonLabel="Downgrade to Professional"
        onChoose={onChoose}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Downgrade to Professional' }));
    expect(onChoose).toHaveBeenCalledWith('professional');
  });

  it('uses primary CTA styling when popular and not current', () => {
    render(
      <PricingPlanCard
        plan={pro}
        canManageStores
        isCurrent={false}
        buttonLabel="Downgrade to Professional"
      />
    );
    expect(screen.getByRole('button', { name: 'Downgrade to Professional' })).toHaveClass(
      'btn-primary'
    );
  });

  it('disables CTA when Professional is already current', () => {
    render(
      <PricingPlanCard
        plan={pro}
        isCurrent
        canManageStores
        buttonLabel="Current plan"
      />
    );
    expect(screen.getByRole('button', { name: 'Current plan' })).toBeDisabled();
  });
});
