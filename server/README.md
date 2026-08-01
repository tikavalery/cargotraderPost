# CargoTrader — Backend API v2

Production-ready MERN backend: **Node.js + Express + MongoDB + Mongoose**

## Folder structure

```
server/src/
├── config/          # env loader, MongoDB connection
├── constants/       # roles, currencies
├── controllers/     # route handlers (business logic)
├── middleware/      # auth, RBAC, error handler
├── models/          # Mongoose schemas
├── routes/          # REST route definitions
├── utils/           # tokens, seed, helpers
└── index.js         # app entry point
```

## Quick start

```bash
cd server
npm install
cp .env.example .env   # set MONGODB_URI + JWT secrets
npm run seed           # sample business + inventory data
npm run dev
```

API: `http://localhost:5000/api/health`

## Connect React frontend

### 1. Vite proxy (already configured in `client/vite.config.js`)

```js
proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true } }
```

### 2. Axios client (`client/src/api/index.js`)

```js
const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('afritrade_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const businessId = localStorage.getItem('afritrade_business_id');
  if (businessId) config.headers['X-Business-Id'] = businessId;
  return config;
});
```

After login/register, store:

```js
localStorage.setItem('afritrade_token', res.data.token);
localStorage.setItem('afritrade_refresh_token', res.data.refreshToken);
localStorage.setItem('afritrade_business_id', res.data.user.defaultBusinessId);
```

### 3. Environment

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB Atlas or local URI |
| `JWT_SECRET` | Access token secret |
| `JWT_REFRESH_SECRET` | Refresh token secret (optional, falls back to JWT_SECRET) |
| `CLIENT_URL` | React origin for CORS |

## API routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account + business |
| POST | `/api/auth/login` | Sign in (rememberMe) |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Current user |
| GET | `/api/businesses` | User's businesses |
| GET | `/api/items?search=&page=&limit=` | Inventory items |
| GET | `/api/bales` | Bales/lots |
| GET | `/api/warehouses` | Warehouses |
| POST | `/api/warehouses/transfer` | Move stock |
| GET | `/api/purchases` | Purchase orders |
| GET | `/api/suppliers` | Suppliers |
| GET | `/api/shipments?mode=active&status=` | Shipments |
| PATCH | `/api/shipments/:id/status` | Update tracking status |
| GET | `/api/sales?source=POS` | POS / marketplace sales |
| GET | `/api/notifications` | User notifications |

**Business context:** Pass `X-Business-Id` header or `?businessId=` on scoped routes.

## Roles (RBAC)

- Business Owner, Warehouse Worker, Store Clerk, Accountant, Individual Seller, Admin

Permissions enforced via `middleware/rbac.js` on each route group.

Run `npm run seed` after `WIPE_DB=true` if you need a fresh database with sample data. Sign in with a registered account that owns that business.
