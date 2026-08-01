import ApiError, { asyncHandler } from '../utils/ApiError.js';
import {
  createPortalSession,
  isStripeConfigured,
  resolveStripeCustomerId
} from '../services/stripeService.js';

/**
 * POST /api/stripe/customer-portal
 * Creates a Stripe Customer Portal session for the logged-in user's business.
 * Portal allows: update payment method, cancel subscription, view invoices.
 */
export const createCustomerPortal = asyncHandler(async (req, res) => {
  if (!isStripeConfigured()) {
    throw new ApiError(503, 'Stripe is not configured. Add STRIPE_SECRET_KEY to server/.env');
  }

  const customerId = await resolveStripeCustomerId(req.businessId, req.userDoc?.email);
  if (!customerId) {
    throw new ApiError(
      404,
      'No Stripe billing account found. Subscribe to a paid plan first, then manage billing here.'
    );
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const defaultReturn = `${clientUrl.replace(/\/$/, '')}/pricing?portal=return`;
  const returnUrl = req.body?.returnUrl || defaultReturn;

  const session = await createPortalSession({ customerId, returnUrl });

  res.json({ ok: true, url: session.url });
});
