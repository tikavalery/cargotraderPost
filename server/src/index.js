import './config/env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, getDbStatus, prisma } from './config/db.js';
import Shipment from './models/Shipment.js';
import Item from './models/Item.js';
import { getPlanLimit } from './constants/plans.js';
import { sweepExpiredGracePeriods } from './services/subscriptionService.js';
import { startTrackingPoller } from './services/tracking/trackingPoller.js';
import { configureCloudinary, isCloudinaryConfigured } from './config/cloudinary.js';
import apiRoutes from './routes/index.js';
import { stripeWebhookHandler } from './controllers/subscriptionController.js';
import { flutterwaveWebhookHandler } from './controllers/posMobileMoneyController.js';
import { notFound, default as errorHandler } from './middleware/errorHandler.js';
import { assertProductionSafety, logProductionReadiness } from './utils/productionChecks.js';
import { apiRateLimiter } from './middleware/rateLimits.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

assertProductionSafety();

if (isProd || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    // Required for Google Identity Services popup / FedCM to return to the opener.
    // Default "same-origin" leaves users on a blank accounts.google.com/gsi/transform page.
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }
  })
);
app.use(morgan(isProd ? 'combined' : 'dev'));
const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
const extraClientUrls = String(process.env.CLIENT_URLS || '')
  .split(',')
  .map((u) => u.trim().replace(/\/$/, ''))
  .filter(Boolean);
const allowedOrigins = new Set([clientUrl, ...extraClientUrls]);

function isAllowedCorsOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    if (host === 'localhost' || host === '127.0.0.1') return true;
    // Preview / production frontends
    if (host.endsWith('.vercel.app')) return true;
    if (host.endsWith('.railway.app')) return true;
    if (host.endsWith('.herokuapp.com')) return true;
  } catch {
    return false;
  }
  return false;
}

app.use(
  cors({
    origin(origin, callback) {
      // Non-browser clients (health checks, curl) send no Origin.
      if (isAllowedCorsOrigin(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true
  })
);

// Stripe webhook must receive the raw body (before express.json)
app.post(
  '/api/subscriptions/webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhookHandler
);

// Flutterwave mobile money webhook (JSON body + verif-hash header)
app.post('/api/pos/mobile-money/webhook', express.json(), flutterwaveWebhookHandler);

app.use(express.json({ limit: '15mb' }));
app.use('/api', apiRateLimiter);

app.get('/api/health', (req, res) => {
  // Always 200 once the process is listening — Railway healthchecks treat 503 as failure.
  const db = getDbStatus();
  res.status(200).json({
    status: db.ready ? 'ok' : 'degraded',
    app: 'CargoTrader API',
    version: '2.0.0',
    db,
    plansBuild: '2026-07-pro-3k-inv-6k-ai',
    freeInventoryLimit: getPlanLimit('free', 'inventoryItems'),
    professionalInventoryLimit: getPlanLimit('professional', 'inventoryItems'),
    professionalWarehouses: getPlanLimit('professional', 'warehouses'),
    professionalStores: getPlanLimit('professional', 'stores'),
    professionalAiLimit: getPlanLimit('professional', 'aiAnalysesPerMonth'),
    professionalPlusInventoryLimit: getPlanLimit('professional_plus', 'inventoryItems'),
    professionalPlusWarehouses: getPlanLimit('professional_plus', 'warehouses'),
    professionalPlusStores: getPlanLimit('professional_plus', 'stores'),
    professionalPlusAiLimit: getPlanLimit('professional_plus', 'aiAnalysesPerMonth')
  });
});

app.use('/api', apiRoutes);

// Serve the Vite build whenever it exists (Heroku / production). Do not rely
// only on NODE_ENV — if Config Vars omit it, GET / would return API 404 JSON.
const clientDist = path.resolve(__dirname, '../../client/dist');
const clientIndex = path.join(clientDist, 'index.html');
const serveClient = fs.existsSync(clientIndex);

if (serveClient) {
  console.log(`[static] Serving UI from ${clientDist}`);
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(clientIndex);
  });
} else {
  console.warn(
    `[static] No UI build at ${clientIndex}. Run client build (Heroku: heroku-postbuild). NODE_ENV=${process.env.NODE_ENV || '(unset)'}`
  );
}

app.use(notFound);
app.use(errorHandler);

connectDB()
  .then(async () => {
    await Shipment.reconcileIndexes().catch((err) => {
      console.warn('[shipments] index reconcile failed:', err.message);
    });
    await Item.reconcileIndexes().catch((err) => {
      console.warn('[items] index reconcile failed:', err.message);
    });
    if (process.env.WIPE_DB === 'true') {
      if (isProd) {
        console.error('[safety] WIPE_DB ignored in production');
      } else {
        const tables = await prisma.$queryRaw`
          SELECT tablename FROM pg_tables WHERE schemaname = 'public'
        `;
        for (const row of tables) {
          if (row.tablename === '_prisma_migrations') continue;
          await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${row.tablename}" CASCADE`);
        }
        console.log('Database wiped (all tables truncated).');
      }
    }
    if (process.env.DELETE_USERS) {
      if (isProd) {
        console.error('[safety] DELETE_USERS ignored in production');
      } else {
        const { deleteUsersByEmail } = await import('./utils/deleteUsers.js');
        const emails = String(process.env.DELETE_USERS)
          .split(',')
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean);
        if (emails.length) {
          await deleteUsersByEmail(emails);
          console.log('DELETE_USERS complete — clear DELETE_USERS from server/.env and restart.');
        }
      }
    }
    // Bind 0.0.0.0 so Railway / containers can reach the process.
    const server = app.listen(PORT, '0.0.0.0', () => {
      configureCloudinary();
      console.log(`CargoTrader API v2 running on port ${PORT}`);
      console.log(
        isCloudinaryConfigured()
          ? 'Cloudinary: configured (uploads → secure HTTPS URLs)'
          : 'Cloudinary: not configured — uploads fall back to data URLs (set CLOUDINARY_* in .env)'
      );
      if (isCloudinaryConfigured()) {
        const tlsFlag = (process.env.CLOUDINARY_TLS_REJECT_UNAUTHORIZED || '').trim().toLowerCase();
        const tlsRelaxed =
          tlsFlag === 'false' ||
          tlsFlag === '0' ||
          (tlsFlag === '' && process.env.NODE_ENV !== 'production');
        if (tlsRelaxed) {
          console.log(
            'Cloudinary TLS: certificate verification relaxed (dev / CLOUDINARY_TLS_REJECT_UNAUTHORIZED=false)'
          );
        }
      }
      console.log('Subscription routes: /api/subscriptions/downgrade, /select-free, /sync');
      console.log('Stripe routes: /api/stripe/customer-portal');
      console.log('Stripe webhooks: invoice.payment_failed, invoice.payment_succeeded, customer.subscription.updated');
      console.log('Flutterwave webhooks: POST /api/pos/mobile-money/webhook (charge.completed)');
      logProductionReadiness();
    });

    const GRACE_SWEEP_MS = 60 * 60 * 1000;
    setInterval(() => {
      sweepExpiredGracePeriods().catch((err) =>
        console.error('[payment grace] sweep failed:', err.message)
      );
    }, GRACE_SWEEP_MS);

    startTrackingPoller();

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} in use — stop other process or change PORT in server/.env`);
      } else {
        console.error('Server error:', err.message);
      }
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error('DB connection failed:', err.message);
    process.exit(1);
  });
