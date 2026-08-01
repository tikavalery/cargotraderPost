/**
 * Create Stripe Products + Prices for Professional, Professional Plus, and Enterprise.
 * Prints env lines to paste into server/.env
 *
 * Usage: node src/utils/seedStripePlans.js
 */
import 'dotenv/config';
import Stripe from 'stripe';
import { PLAN_CATALOG } from '../constants/plans.js';

const PAID_PLANS = ['professional', 'professional_plus', 'enterprise'];

function envPriceKey(planId, interval) {
  return `STRIPE_PRICE_${planId.toUpperCase()}_${interval === 'year' ? 'YEARLY' : 'MONTHLY'}`;
}

function envProductKey(planId) {
  return `STRIPE_PRODUCT_${planId.toUpperCase()}`;
}

async function findOrCreateProduct(stripe, plan) {
  const products = await stripe.products.list({ active: true, limit: 100 });
  const name = `CargoTrader ${plan.name}`;
  const existing = products.data.find(
    (p) => p.metadata?.planId === plan.id || p.name === name
  );
  if (existing) {
    console.log(`  Product exists: ${existing.id} (${existing.name})`);
    return existing;
  }
  const created = await stripe.products.create({
    name,
    description: plan.tagline,
    metadata: { planId: plan.id }
  });
  console.log(`  Created product: ${created.id} (${created.name})`);
  return created;
}

async function findOrCreatePrice(stripe, productId, plan, interval) {
  const unitAmount =
    interval === 'year'
      ? Math.round(plan.priceYearly * 100)
      : Math.round(plan.priceMonthly * 100);

  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 100
  });
  const match = prices.data.find(
    (p) =>
      p.currency === 'usd' &&
      p.unit_amount === unitAmount &&
      p.recurring?.interval === interval
  );
  if (match) {
    console.log(`  Price exists (${interval}): ${match.id} — $${(unitAmount / 100).toFixed(2)}`);
    return match;
  }
  const created = await stripe.prices.create({
    product: productId,
    currency: 'usd',
    unit_amount: unitAmount,
    recurring: { interval },
    nickname: `${plan.name} ${interval === 'year' ? 'Yearly' : 'Monthly'}`,
    metadata: { planId: plan.id, interval }
  });
  console.log(`  Created price (${interval}): ${created.id} — $${(unitAmount / 100).toFixed(2)}`);
  return created;
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.includes('...')) {
    console.error('Set a real STRIPE_SECRET_KEY in server/.env first.');
    process.exit(1);
  }

  // Windows antivirus / SSL inspection can break Stripe API TLS in local dev
  if (process.env.NODE_ENV !== 'production' && process.env.STRIPE_TLS_REJECT_UNAUTHORIZED === 'false') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  const stripe = new Stripe(key);
  const envLines = [];

  console.log('Seeding Stripe products & prices for CargoTrader plans…\n');

  for (const planId of PAID_PLANS) {
    const plan = PLAN_CATALOG[planId];
    console.log(`→ ${plan.name}`);
    const product = await findOrCreateProduct(stripe, plan);
    envLines.push(`${envProductKey(planId)}=${product.id}`);

    const monthly = await findOrCreatePrice(stripe, product.id, plan, 'month');
    const yearly = await findOrCreatePrice(stripe, product.id, plan, 'year');
    envLines.push(`${envPriceKey(planId, 'month')}=${monthly.id}`);
    envLines.push(`${envPriceKey(planId, 'year')}=${yearly.id}`);
    console.log('');
  }

  console.log('Add/replace these lines in server/.env:\n');
  console.log(envLines.join('\n'));
  console.log('\nRestart the API after updating .env.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
