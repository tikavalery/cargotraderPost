/**
 * Unit checks for subscription sync safety (no Stripe / DB required).
 * Run: node --test src/services/subscriptionSync.safety.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  planFromStripeSubscription,
  planFromMetadata
} from './subscriptionService.js';

describe('planFromStripeSubscription', () => {
  it('returns null when Stripe price/product cannot be mapped (never defaults to professional)', () => {
    const stripeSub = {
      metadata: {},
      items: {
        data: [
          {
            price: {
              id: 'price_unknown_xyz',
              unit_amount: 99999,
              recurring: { interval: 'month' },
              product: { name: 'Mystery Product' }
            }
          }
        ]
      }
    };
    assert.equal(planFromStripeSubscription(stripeSub), null);
  });

  it('resolves professional from product name', () => {
    const stripeSub = {
      metadata: {},
      items: {
        data: [
          {
            price: {
              id: 'price_unknown',
              product: { name: 'Professional' }
            }
          }
        ]
      }
    };
    assert.equal(planFromStripeSubscription(stripeSub), 'professional');
  });

  it('resolves plan from metadata.planId', () => {
    assert.equal(planFromMetadata({ planId: 'enterprise' }), 'enterprise');
    assert.equal(planFromMetadata({ plan: 'professional_plus' }), 'professional_plus');
    assert.equal(planFromMetadata({}), null);
  });
});
