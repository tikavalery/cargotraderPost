import { isSmtpConfigured } from '../services/emailService.js';
import { isStripeConfigured } from '../services/stripeService.js';
import { isCloudinaryConfigured } from '../config/cloudinary.js';

const PLACEHOLDER_SECRETS = [
  'change-this-to-a-long-random-secret-in-production',
  'change-this-refresh-secret-in-production',
  'change-this',
  'changeme',
  'your-secret',
  'jwt_secret',
  'secret'
];

function isWeakSecret(value) {
  const s = String(value || '').trim();
  if (s.length < 32) return true;
  const lower = s.toLowerCase();
  if (PLACEHOLDER_SECRETS.some((p) => lower === p || lower.startsWith('change-this'))) return true;
  return false;
}

/**
 * Fail fast in production when critical secrets / services are missing.
 */
export function assertProductionSafety() {
  if (process.env.NODE_ENV !== 'production') return;

  const errors = [];

  if (!process.env.DATABASE_URL?.trim()) {
    errors.push('DATABASE_URL is required in production (Railway PostgreSQL connection string)');
  }
  if (isWeakSecret(process.env.JWT_SECRET)) {
    errors.push('JWT_SECRET must be a strong random value (32+ chars; not a placeholder)');
  }
  if (isWeakSecret(process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET)) {
    errors.push('JWT_REFRESH_SECRET must be a strong random value (32+ chars; not a placeholder)');
  }
  if (!process.env.CLIENT_URL?.trim() || /localhost|127\.0\.0\.1/i.test(process.env.CLIENT_URL)) {
    errors.push('CLIENT_URL must be your public HTTPS app URL in production');
  }
  if (!isCloudinaryConfigured()) {
    errors.push('CLOUDINARY_* credentials are required in production (no data-URL uploads)');
  }
  if (!isSmtpConfigured()) {
    errors.push('SMTP_* is required in production for invites, password reset, and billing email');
  }
  if (isStripeConfigured()) {
    if (!process.env.STRIPE_WEBHOOK_SECRET?.trim()) {
      errors.push('STRIPE_WEBHOOK_SECRET is required when Stripe is configured');
    }
    const stripeKey = String(process.env.STRIPE_SECRET_KEY || '');
    const isLiveStripe = stripeKey.startsWith('sk_live');
    // Test mode may auto-create a portal config at runtime; live mode must pin one.
    if (isLiveStripe && !process.env.STRIPE_PORTAL_CONFIGURATION_ID?.trim()) {
      errors.push('STRIPE_PORTAL_CONFIGURATION_ID must be pinned for live Stripe Customer Portal');
    }
  }
  if (process.env.WIPE_DB === 'true') {
    errors.push('WIPE_DB=true is forbidden in production');
  }
  if (process.env.DELETE_USERS?.trim()) {
    errors.push('DELETE_USERS is forbidden in production — clear it from the environment');
  }

  if (errors.length) {
    console.error('[production] Refusing to start — fix the following:');
    for (const msg of errors) console.error(`[production]  • ${msg}`);
    process.exit(1);
  }
}

/**
 * Log production readiness warnings for billing ops.
 */
export function logProductionReadiness() {
  const isProd = process.env.NODE_ENV === 'production';
  const prefix = isProd ? '[production]' : '[ops]';
  const warnings = [];

  if (isStripeConfigured()) {
    if (!process.env.STRIPE_WEBHOOK_SECRET?.trim()) {
      warnings.push('STRIPE_WEBHOOK_SECRET is missing — subscription webhooks cannot be verified');
    }
    if (!process.env.STRIPE_PORTAL_CONFIGURATION_ID?.trim()) {
      warnings.push(
        'STRIPE_PORTAL_CONFIGURATION_ID is unset — pin a Dashboard configuration ID for production'
      );
    }
    if (!isSmtpConfigured()) {
      warnings.push(
        'SMTP_* is not configured — payment-failed / receipt / downgrade emails will only log to the console'
      );
    }
    const taxFlag = (process.env.STRIPE_AUTOMATIC_TAX || '').trim().toLowerCase();
    if (isProd && taxFlag !== 'true' && taxFlag !== '1') {
      warnings.push(
        'STRIPE_AUTOMATIC_TAX is not enabled — enable Stripe Tax or document tax-excluded pricing'
      );
    }
    if (!process.env.CLIENT_URL?.trim()) {
      warnings.push('CLIENT_URL is unset — Checkout success/cancel and portal return URLs may be wrong');
    }
    if (String(process.env.STRIPE_SECRET_KEY || '').startsWith('sk_test') && isProd) {
      warnings.push('STRIPE_SECRET_KEY is a test key — live customers cannot be charged');
    }
  }

  if (!isCloudinaryConfigured()) {
    warnings.push('Cloudinary is not configured — uploads fall back to data URLs (dev only)');
  }

  if (isProd && !process.env.SUPPORT_EMAIL?.trim() && !process.env.SMTP_FROM?.trim()) {
    warnings.push('SUPPORT_EMAIL (or SMTP_FROM) is unset — contact/support addressing may be unclear');
  }

  if (!process.env.PLATFORM_ADMIN_EMAILS?.trim()) {
    warnings.push(
      'PLATFORM_ADMIN_EMAILS is unset — no cross-tenant platform operators (set only for trusted ops emails)'
    );
  }

  if (!warnings.length) {
    if (isStripeConfigured() && isProd) {
      console.log(`${prefix} Billing ops checks passed`);
    }
    return warnings;
  }

  console.warn(`${prefix} Launch readiness — ${warnings.length} item(s) to review:`);
  for (const msg of warnings) {
    console.warn(`${prefix}  • ${msg}`);
  }
  return warnings;
}

/** Block wipe/seed CLI outside explicit non-production use. */
export function assertDestructiveOpsAllowed(actionLabel = 'Destructive operation') {
  if (process.env.NODE_ENV === 'production') {
    console.error(`[safety] ${actionLabel} blocked: NODE_ENV=production`);
    process.exit(1);
  }
  if (process.env.ALLOW_DESTRUCTIVE_OPS !== 'true') {
    console.error(
      `[safety] ${actionLabel} blocked. Set ALLOW_DESTRUCTIVE_OPS=true in server/.env (never in production).`
    );
    process.exit(1);
  }
}
