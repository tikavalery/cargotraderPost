# CargoTrader ERP — PERN Stack

Production-ready **PostgreSQL + Express + React + Node.js** application for thrift import, shipping logistics, inventory, POS, finance, and marketplace operations (Cameroon & West Africa).

## What This Application Does

CargoTrader is an ERP for businesses that:
- **Source** goods internationally (China, Turkey, Dubai, etc.)
- **Ship** freight to Cameroon/West Africa ports
- **Store** inventory in warehouses
- **Sell** via physical POS and online marketplace
- **Track** finances, P&L per shipment, and reports

This version adds:
- **PostgreSQL** persistent database (Prisma ORM)
- **REST API** with JWT authentication (bcrypt passwords)
- **React SPA** with React Router — all pages connected
- **Protected routes** on every ERP page
- **Cross-module sync** (POS → Finance, Shipments → Ledger, etc.)

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ running locally

### Install & Run

```bash
cd "Shipping Website PostSQL"
npm run install:all
cp server/.env.example server/.env   # set DATABASE_URL & JWT_SECRET
cd server && npx prisma db push      # create tables
npm run seed                          # seed sample business data (from server/ or root)
npm run dev                           # starts API :5000 + React :5173
```

Example `DATABASE_URL`:

```
DATABASE_URL=postgresql://cargotrader:cargotrader_dev@127.0.0.1:5432/afritrade?schema=public
```

Open **http://localhost:5173** and register or sign in with your account.

Seed login (local only): `owner@cargotrader.local` / `seed-owner-change-me`

### Production Build

```bash
npm run build        # builds React to client/dist
NODE_ENV=production npm start   # serves API + static React build
```

## Project Structure

```
├── client/          React + Vite frontend
│   └── src/
│       ├── pages/   All ERP modules (connected routes)
│       ├── api/     Axios API client
│       └── components/ Layout, auth guards
├── server/          Express API
│   └── src/
│       ├── models/  Mongoose schemas
│       └── routes/  REST endpoints
└── (legacy)/        Original static HTML prototype
```

## Connected Routes (React)

| Route | Module |
|-------|--------|
| `/dashboard` | KPI overview |
| `/inventory/*` | Individual Items |
| `/purchases` | Suppliers & purchase orders |
| `/warehouses` | Stock & transfers |
| `/shipments/*` | Active, Completed, Documents |
| `/pos/*` | Terminal, Transactions, Held, Returns, Register |
| `/finance/*` | Dashboard, Revenue, Expenses, P&L, Cash Flow |
| `/marketplace/*` | Shop, Wishlist, Sell, Orders, Checkout |
| `/reports` | CSV export reports |
| `/users` | Team & roles |
| `/settings` | Profile & business |

## API Endpoints (v2)

See **[server/README.md](server/README.md)** for the full REST API reference.

Core routes:
- `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/refresh` · `GET /api/auth/me`
- `/api/businesses` · `/api/items` · `/api/bales` · `/api/warehouses` · `/api/purchases`
- `/api/suppliers` · `/api/shipments` · `/api/sales` · `/api/notifications`

Legacy aliases still work: `/api/inventory/*`, `/api/pos/sales`, `/api/dashboard`.

Pass `Authorization: Bearer <token>` and `X-Business-Id: <businessId>` on business-scoped routes.

## Subscription plans

Defined in `server/src/constants/plans.js` and mirrored in `client/src/constants/plans.js`. Stripe setup: **[server/STRIPE_SETUP.md](server/STRIPE_SETUP.md)**.

| | Free | Professional | Professional Plus | Enterprise |
|--|------|--------------|-------------------|------------|
| **Price** | $0 | $19/mo · $182.40/yr | $29/mo · $278.40/yr | $49/mo · $470.40/yr |
| **Inventory items** | 100 | 3,000 | 10,000 | Unlimited |
| **Warehouses** | 1 | 5 | 10 | Unlimited |
| **Users / staff** | 2 | 15 | 15 | Unlimited |
| **Shipments / year** | 1 | Unlimited | Unlimited | Unlimited |
| **Stores (POS)** | 1 | 5 | 10 | Unlimited |
| **Purchases / Shipping / POS** | Included | Included | Included | Included |
| **AI Purchase Assistant** | — | 6,000/month | 20,000/month | Unlimited |

Billing: Stripe Checkout (first paid plan, optional free trial via `STRIPE_TRIAL_PERIOD_DAYS`), in-place subscription update on upgrade, Customer Portal for cards / cancel / `past_due`. SMTP billing emails for payment failed / receipts / downgrades (plus enable Stripe Dashboard customer emails). Pricing UI: `/pricing`.

**Downgrade over-limit policy (grandfather):** existing inventory/warehouses/stores/users are kept and remain editable. New creates are blocked until the business upgrades or reduces usage. See `server/src/constants/planLimitPolicy.js`.

## Static Prototype Fixes

The legacy HTML folders remain for reference. Fixed broken links:
- Created `MarketPlace/wishlist.html` and `MarketPlace/sell.html`
- Fixed Finance P&L and cash flow hash anchors (`#pl-shipments`, `#recent-transactions`)
- Added Shipments sub-nav: Active → Completed → Documents

## Still Needed for Full Production

| Area | Status |
|------|--------|
| Database & API | ✅ Implemented |
| Auth & route guards | ✅ JWT on all pages |
| Page navigation | ✅ React Router |
| Subscriptions (Stripe) | ✅ Plans in `plans.js`; see `server/STRIPE_SETUP.md` |
| Carrier tracking APIs | ⚠️ Backend + mock/Shippo/EasyPost — set live keys for prod |
| File upload (B/L, invoices, photos) | ✅ Cloudinary (`CLOUDINARY_*` env vars) |
| Payment gateways (MoMo, Orange) | ⚠️ Flutterwave POS MoMo implemented — set live keys for prod |
| Email / SMS notifications | ⚠️ SMTP email yes; SMS not implemented |
| Multi-tenant org isolation | ✅ Business-scoped data + `X-Business-Id` |
| Automated tests & CI/CD | ❌ |

## License

Private — CargoTrader ERP
