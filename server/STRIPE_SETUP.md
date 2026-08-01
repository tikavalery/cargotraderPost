# Stripe subscription setup (CargoTrader)

This guide covers test-mode Stripe for paid plans. **Source of truth for limits and prices:** `server/src/constants/plans.js` (keep `client/src/constants/plans.js` in sync).

| Plan | Monthly | Yearly (20% off) |
|------|---------|------------------|
| Free | $0 | $0 |
| Professional | $19/mo | $182.40/yr (~$15.20/mo) |
| Professional Plus | $29/mo | $278.40/yr (~$23.20/mo) |
| Enterprise | $49/mo | $470.40/yr (~$39.20/mo) |

## 1. Create a Stripe account

1. Sign up at [https://stripe.com](https://stripe.com).
2. Enable **Test mode** (toggle in the Dashboard header).

## 2. API keys

1. Open **Developers → API keys**.
2. Copy the **Secret key** (`sk_test_...`) into `server/.env`:

```env
STRIPE_SECRET_KEY=sk_test_xxxxxxxx
CLIENT_URL=http://localhost:5173
```

The app uses **Checkout** in subscription mode. You do **not** need a publishable key on the frontend for this flow.

## 3. Webhook (local development)

Stripe must notify your API when checkout completes or subscriptions change.

### Install Stripe CLI

Download from [https://stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli).

### Forward events to your server

With the API running on port 5000:

```bash
stripe login
stripe listen --forward-to localhost:5000/api/subscriptions/webhook
```

The CLI prints a webhook signing secret like `whsec_...`. Add it to `server/.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxx
```

Restart the Node server after updating `.env`.

### Events handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Activates plan after successful checkout |
| `invoice.payment_failed` | Starts 7-day grace period (`past_due`) |
| `invoice.payment_succeeded` | Clears grace period when subscription is healthy |
| `customer.subscription.updated` | Syncs status, renewal date, plan changes |
| `customer.subscription.deleted` | Downgrades business to Free |

## 4. Optional: fixed Price IDs

By default, checkout uses **dynamic `price_data`** (no Products required in Stripe).

For production, create Products/Prices (or run the seed script) and set:

```bash
cd server && npm run seed:stripe
```

Then paste the printed values into `server/.env`:

```env
STRIPE_PRODUCT_PROFESSIONAL=prod_...
STRIPE_PRODUCT_PROFESSIONAL_PLUS=prod_...
STRIPE_PRODUCT_ENTERPRISE=prod_...
STRIPE_PRICE_PROFESSIONAL_MONTHLY=price_...
STRIPE_PRICE_PROFESSIONAL_YEARLY=price_...
STRIPE_PRICE_PROFESSIONAL_PLUS_MONTHLY=price_...
STRIPE_PRICE_PROFESSIONAL_PLUS_YEARLY=price_...
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_...
STRIPE_PRICE_ENTERPRISE_YEARLY=price_...
```

Yearly prices should reflect the **20% discount** ($182.40/yr Professional, $278.40/yr Professional Plus, $470.40/yr Enterprise).

**Plan caps:** Professional — 3,000 inventory · 5 warehouses · 5 stores · 6,000 AI/month. Professional Plus — 10,000 inventory · 10 warehouses · 10 stores · 20,000 AI/month. Enterprise — unlimited.

## 5. Production webhook

1. **Developers → Webhooks → Add endpoint**
2. URL: `https://your-api-domain.com/api/subscriptions/webhook`
3. Select the five events listed above (`checkout.session.completed`, invoice payment failed/succeeded, subscription updated/deleted).
4. Copy the **Signing secret** into production `STRIPE_WEBHOOK_SECRET`.
5. Use live keys (`sk_live_...`) only in production.

Webhook handlers store each Stripe `event.id` in MongoDB (`StripeWebhookEvent`) after successful processing so retries do not re-send billing emails or re-apply side effects.

## 5b. Production ops checklist (before charging live)

| Item | Env / action |
|------|----------------|
| SMTP for billing emails | Set real `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |
| Support contact | `SUPPORT_EMAIL` (server) + `VITE_SUPPORT_EMAIL` (client) for `/contact` |
| Customer Portal config | **Pin** `STRIPE_PORTAL_CONFIGURATION_ID` from Dashboard → Settings → Billing → Customer portal |
| Stripe Tax (optional) | Enable Tax in Dashboard, then `STRIPE_AUTOMATIC_TAX=true` |
| Legal URLs | App serves `/terms`, `/privacy`, `/contact` — set the same ToS URL in Stripe Dashboard public details if you use Checkout consent |

On boot, production logs `[production]` warnings when Stripe is configured but SMTP / portal ID / tax / `CLIENT_URL` look incomplete.

### Currency & tax

- **SaaS subscription fees are always USD** (card via Stripe), even when the business prefers XAF (or another currency) for inventory/POS amounts inside the app.
- Checkout collects a billing address. Set `STRIPE_AUTOMATIC_TAX=true` only after Stripe Tax is configured in the Dashboard; otherwise leave it `false` and disclose “tax excluded / calculated at checkout when enabled” on Pricing.

## 6. Test the flow

1. Start MongoDB, server (`npm run dev`), and client.
2. Run `stripe listen --forward-to localhost:5000/api/subscriptions/webhook`.
3. Sign in as a Business Owner after registering, or use a seeded sample owner account if you ran `npm run seed`.
4. Open **Settings → Pricing & Plans** or `/pricing`.
5. Choose **Professional** or **Enterprise** → Stripe Checkout opens.
6. Use test card `4242 4242 4242 4242`, any future expiry, any CVC.
7. After redirect, the current plan badge should update.

### Upgrades (no duplicate subscriptions)

- First paid plan → Stripe Checkout.
- Already subscribed (active/trialing) → API updates the existing Stripe subscription in place (proration). No second Checkout.
- `past_due` → Customer Portal to fix the card (Checkout is blocked).
- Extra Stripe subscriptions for the same business are canceled automatically.

### Billing emails (app + Stripe)

CargoTrader sends its own billing emails over SMTP (same `SMTP_*` settings as invites / password reset) to the business owner and managers:

| Event | Email |
|-------|--------|
| `invoice.payment_failed` | Payment failed + grace deadline + link to Pricing |
| `invoice.payment_succeeded` | Payment receipt (amount, invoice link/PDF when Stripe provides them) |
| Downgrade scheduled / applied | Confirmation with effective date or new plan |

If SMTP is not configured, the server logs the email to the console instead of failing the webhook.

**Also enable Stripe’s emails** in Dashboard → Settings → Customer emails (successful payments, failed payments, upcoming renewals). Those are separate from CargoTrader’s SMTP notices.

### Free trial

First paid Checkout includes a free trial via Stripe `subscription_data.trial_period_days`:

```env
# Default 7. Set 0 to disable trials.
STRIPE_TRIAL_PERIOD_DAYS=7
```

- Applied only for **new** paid subscribers (no prior Stripe subscription history).
- Upgrades / returning customers do **not** get another trial.
- Card is collected at checkout (`payment_method_collection: always`); billing starts when the trial ends.
- While `status === trialing`, the pricing page shows when the trial ends.

## 7. Plan limits & modules (must match `plans.js`)

Enforced server-side (`enforceInventoryItemLimit`, warehouse/store/shipment/user caps, feature gates). UI pricing page reads the same catalog via `GET /api/subscriptions/plans`.

| | Free | Professional | Enterprise |
|--|------|--------------|------------|
| **Price** | $0 | $19/mo or $182.40/yr | $49/mo or $470.40/yr |
| **Inventory items** | 100 | Unlimited | Unlimited |
| **Warehouses** | 1 | 5 | Unlimited |
| **Users / staff** | 2 | 15 | Unlimited |
| **Shipments / year** | 1 | Unlimited | Unlimited |
| **Stores (POS)** | 1 | Unlimited | Unlimited |
| **Purchases & sourcing** | Included | Included | Included |
| **Shipping management** | Included (1 shipment/yr) | Included | Included |
| **POS / stores & sales** | Included (1 store) | Included | Included |
| **Staff accounts** | Included (within user cap) | Included | Included |

Notes:

- Free is assigned automatically when a business is created.
- Downgrade on `/pricing` schedules change at **period end** (Stripe `cancel_at_period_end` or price swap). Use **Manage billing** for card updates / cancel / plan switch in the Customer Portal.
- During `past_due`, effective access falls back to Free limits until payment is fixed or the 7-day grace expires.
- Optional env overrides: `PLAN_LIMIT_FREE_INVENTORYITEMS`, etc. (see `server/.env.example`).

### Downgrade over-limit policy: grandfather

Defined in `server/src/constants/planLimitPolicy.js`:

- **Existing data is kept** (view + edit). Nothing is force-archived or deleted.
- **New creates are blocked** when usage ≥ plan limit (inventory, warehouses, users, stores, shipments).
- After a downgrade you may temporarily be **over** a limit; banners explain that existing records stay and you must upgrade or reduce usage to add more.
- API `GET /api/subscriptions/usage` returns `status`, `overLimitKeys`, and `policy: "grandfather"`.

## Troubleshooting

- **503 Stripe is not configured** — set `STRIPE_SECRET_KEY` in `server/.env`.
- **Webhook signature error** — `STRIPE_WEBHOOK_SECRET` must match the CLI or Dashboard endpoint secret; webhook route uses raw body (already configured in `server/src/index.js`).
- **Plan not updating after payment** — confirm `stripe listen` is running and check server logs for `[stripe webhook]` messages.
