import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PricingPlanCard from './PricingPlanCard';
import { STATIC_PLANS, featureDisplay, FEATURE_ROWS } from '../../constants/plans';

const freePlan = STATIC_PLANS.free;

describe('PricingPlanCard — Free plan (unit)', () => {
  it('renders Free name, tagline, Free forever pricing, and Downgrade CTA', () => {
    render(
      <PricingPlanCard
        plan={freePlan}
        interval="month"
        canManageStores
        buttonLabel="Downgrade to Free"
        onChoose={vi.fn()}
      />
    );

    const card = screen.getByTestId('pricing-card-free');
    expect(within(card).getByRole('heading', { name: 'Free' })).toBeInTheDocument();
    expect(within(card).getByText('Get started with core inventory tools')).toBeInTheDocument();
    expect(within(card).getByText('Free', { selector: '.pricing-amount' })).toBeInTheDocument();
    expect(within(card).getByText('Free forever')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Downgrade to Free' })).toBeEnabled();
    expect(within(card).queryByText(/free trial/i)).not.toBeInTheDocument();
  });

  it('lists Free plan feature limits matching the pricing catalog', () => {
    render(
      <PricingPlanCard
        plan={freePlan}
        canManageStores
        buttonLabel="Downgrade to Free"
      />
    );

    const card = screen.getByTestId('pricing-card-free');
    expect(within(card).getByText(/Inventory Items/)).toBeInTheDocument();
    expect(card).toHaveTextContent('100 items');
    expect(card).toHaveTextContent('1 warehouse');
    expect(card).toHaveTextContent('Purchases & Sourcing');
    expect(card).toHaveTextContent('1 shipment/year');
    expect(card).toHaveTextContent('1 store');
    expect(card).toHaveTextContent('Users & Staff Accounts');
    expect(card).toHaveTextContent('AI Assistants (Purchase & Expense)');
    expect(card).toHaveTextContent('—');

    const aiRow = card.querySelector('[data-feature="purchaseAiFill"]');
    expect(aiRow).toHaveClass('muted');
    expect(aiRow.querySelector('i')).toHaveClass('fa-minus');
  });

  it('marks included Free modules with check icons', () => {
    render(
      <PricingPlanCard plan={freePlan} canManageStores buttonLabel="Downgrade to Free" />
    );
    const card = screen.getByTestId('pricing-card-free');
    for (const key of ['inventoryItems', 'warehouses', 'purchases', 'shipping', 'pos', 'staffAccounts']) {
      const row = card.querySelector(`[data-feature="${key}"]`);
      expect(row).not.toHaveClass('muted');
      expect(row.querySelector('i')).toHaveClass('fa-check');
    }
  });

  it('calls onChoose("free") when Downgrade to Free is clicked', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(
      <PricingPlanCard
        plan={freePlan}
        canManageStores
        buttonLabel="Downgrade to Free"
        onChoose={onChoose}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Downgrade to Free' }));
    expect(onChoose).toHaveBeenCalledWith('free');
  });

  it('disables the CTA when the Free plan is already current', () => {
    render(
      <PricingPlanCard
        plan={freePlan}
        isCurrent
        canManageStores
        buttonLabel="Current plan"
        onChoose={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Current plan' })).toBeDisabled();
  });

  it('disables the CTA when the user cannot manage billing', () => {
    render(
      <PricingPlanCard
        plan={freePlan}
        canManageStores={false}
        buttonLabel="Downgrade to Free"
        onChoose={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Downgrade to Free' })).toBeDisabled();
  });

  it('featureDisplay helpers match Free limits used on the card', () => {
    expect(featureDisplay(freePlan, FEATURE_ROWS.find((r) => r.key === 'inventoryItems'))).toBe(
      '100 items'
    );
    expect(featureDisplay(freePlan, FEATURE_ROWS.find((r) => r.key === 'warehouses'))).toBe(
      '1 warehouse'
    );
    expect(featureDisplay(freePlan, FEATURE_ROWS.find((r) => r.key === 'shipping'))).toBe(
      '1 shipment/year'
    );
    expect(featureDisplay(freePlan, FEATURE_ROWS.find((r) => r.key === 'pos'))).toBe('1 store');
    expect(featureDisplay(freePlan, FEATURE_ROWS.find((r) => r.key === 'purchaseAiFill'))).toBe(
      '—'
    );
  });
});
