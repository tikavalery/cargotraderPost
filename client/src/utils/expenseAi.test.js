import { describe, it, expect } from 'vitest';
import { applyAiToExpenseForm } from './expenseAi';

describe('applyAiToExpenseForm', () => {
  const base = {
    date: '2026-07-01',
    category: 'Salaries & Wages',
    description: '',
    amount: '',
    currency: 'XAF',
    reference: '',
    shipmentId: '',
    receipts: ['data:image/jpeg;base64,abc']
  };

  it('fills expense fields and keeps receipts', () => {
    const next = applyAiToExpenseForm(base, {
      date: '2026-07-15',
      category: 'Freight & Shipping',
      description: 'Douala port freight',
      amount: 125000,
      currency: 'XAF',
      reference: 'INV-9',
      shipmentId: 'SHP-1'
    });
    expect(next.date).toBe('2026-07-15');
    expect(next.category).toBe('Freight & Shipping');
    expect(next.description).toBe('Douala port freight');
    expect(next.amount).toBe('125000');
    expect(next.reference).toBe('INV-9');
    expect(next.shipmentId).toBe('SHP-1');
    expect(next.receipts).toEqual(base.receipts);
  });

  it('ignores empty amount and maps legacy category aliases', () => {
    const next = applyAiToExpenseForm(base, {
      category: 'Marketing',
      amount: 0,
      description: 'Ads'
    });
    expect(next.category).toBe('Marketing & Advertising');
    expect(next.amount).toBe('');
    expect(next.description).toBe('Ads');
  });
});
