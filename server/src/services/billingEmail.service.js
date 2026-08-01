import Business from '../models/Business.js';
import User from '../models/User.js';
import { ROLES } from '../constants/roles.js';
import { getPlan } from '../constants/plans.js';
import {
  isSmtpConfigured,
  sendBillingEmail
} from './emailService.js';

const BILLING_ROLES = new Set([
  ROLES.BUSINESS_OWNER,
  ROLES.MANAGER,
  ROLES.ADMIN
]);

function clientUrl(path = '/pricing') {
  const base = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function formatMoney(amountCents, currency = 'usd') {
  if (amountCents == null || !Number.isFinite(Number(amountCents))) return null;
  const amount = Number(amountCents) / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: String(currency || 'usd').toUpperCase()
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${String(currency || 'USD').toUpperCase()}`;
  }
}

function formatDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

/**
 * Emails for business owner + managers/admins who can manage billing.
 */
export async function resolveBillingRecipients(businessId) {
  const business = await Business.findById(businessId).lean();
  if (!business) return { businessName: 'Your business', emails: [] };

  const memberIds = (business.members || [])
    .filter((m) => BILLING_ROLES.has(m.role))
    .map((m) => m.user)
    .filter(Boolean);

  if (business.owner && !memberIds.some((id) => String(id) === String(business.owner))) {
    memberIds.push(business.owner);
  }

  const users = await User.find({
    _id: { $in: memberIds },
    isActive: { $ne: false },
    email: { $exists: true, $ne: '' }
  })
    .select('email name')
    .lean();

  const emails = [...new Set(users.map((u) => String(u.email).trim().toLowerCase()).filter(Boolean))];
  return { businessName: business.name || 'Your business', emails, users };
}

async function sendToBillingContacts(businessId, buildPayload) {
  const { businessName, emails } = await resolveBillingRecipients(businessId);
  if (!emails.length) {
    console.warn(`[billing-email] no recipients for business ${businessId}`);
    return { sent: 0, reason: 'no_recipients' };
  }

  const pricingUrl = clientUrl('/pricing');
  let sent = 0;
  for (const to of emails) {
    const mail = buildPayload({ businessName, pricingUrl });
    const result = await sendBillingEmail({ ...mail, to });
    if (result.sent) sent += 1;
  }
  return { sent, total: emails.length, smtpConfigured: isSmtpConfigured() };
}

/** Payment failed → grace period started. */
export async function notifyPaymentFailed(businessId, {
  planId,
  gracePeriodEnd,
  invoice
} = {}) {
  const planName = getPlan(planId || 'professional').name;
  const graceDate = formatDate(gracePeriodEnd);
  const amount = formatMoney(invoice?.amount_due ?? invoice?.amount_remaining, invoice?.currency);
  const invoiceId = invoice?.number || invoice?.id || null;

  try {
    const result = await sendToBillingContacts(businessId, ({ businessName, pricingUrl }) => ({
      subject: `Payment failed — ${planName} plan for ${businessName}`,
      previewLog: `payment_failed business=${businessId} plan=${planId}`,
      text: [
        `Hello,`,
        '',
        `We could not process a payment for ${businessName}'s ${planName} subscription.`,
        amount ? `Amount due: ${amount}` : null,
        invoiceId ? `Invoice: ${invoiceId}` : null,
        '',
        graceDate
          ? `You have until ${graceDate} to update your payment method before the account is downgraded to Free.`
          : 'Please update your payment method soon to avoid losing paid features.',
        '',
        `Update billing: ${pricingUrl}`,
        '',
        '— CargoTrader'
      ]
        .filter(Boolean)
        .join('\n'),
      html: `
        <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;color:#1A2332">
          <h2 style="color:#C0392B">Payment failed</h2>
          <p>We could not process a payment for <strong>${businessName}</strong>'s <strong>${planName}</strong> subscription.</p>
          ${amount ? `<p><strong>Amount due:</strong> ${amount}</p>` : ''}
          ${invoiceId ? `<p><strong>Invoice:</strong> ${invoiceId}</p>` : ''}
          <p>${
            graceDate
              ? `You have until <strong>${graceDate}</strong> to update your payment method before the account is downgraded to Free.`
              : 'Please update your payment method soon to avoid losing paid features.'
          }</p>
          <p><a href="${pricingUrl}" style="display:inline-block;background:#E85D26;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Update billing</a></p>
          <p style="font-size:12px;color:#8A97A8">You can also open Manage billing on the Pricing page.</p>
        </div>`
    }));
    console.log(`[billing-email] payment_failed → ${result.sent}/${result.total || 0} sent`);
    return result;
  } catch (err) {
    console.error('[billing-email] payment_failed failed:', err.message);
    return { sent: 0, reason: 'error', error: err.message };
  }
}

/** Successful invoice payment / receipt. */
export async function notifyPaymentReceipt(businessId, {
  planId,
  invoice,
  recoveredFromPastDue = false
} = {}) {
  const planName = getPlan(planId || 'professional').name;
  const amount = formatMoney(invoice?.amount_paid ?? invoice?.total, invoice?.currency);
  const invoiceId = invoice?.number || invoice?.id || null;
  const paidAt = formatDate(
    invoice?.status_transitions?.paid_at
      ? invoice.status_transitions.paid_at * 1000
      : invoice?.created
        ? invoice.created * 1000
        : Date.now()
  );
  const hostedUrl = invoice?.hosted_invoice_url || null;
  const pdfUrl = invoice?.invoice_pdf || null;

  try {
    const result = await sendToBillingContacts(businessId, ({ businessName, pricingUrl }) => ({
      subject: recoveredFromPastDue
        ? `Payment received — ${businessName} subscription restored`
        : `Payment receipt — ${businessName} (${planName})`,
      previewLog: `payment_receipt business=${businessId} invoice=${invoiceId || 'n/a'}`,
      text: [
        'Hello,',
        '',
        recoveredFromPastDue
          ? `Thank you — we received your payment and restored paid features for ${businessName}.`
          : `Thank you — we received a payment for ${businessName}'s ${planName} subscription.`,
        amount ? `Amount paid: ${amount}` : null,
        paidAt ? `Date: ${paidAt}` : null,
        invoiceId ? `Invoice: ${invoiceId}` : null,
        hostedUrl ? `View invoice: ${hostedUrl}` : null,
        pdfUrl ? `PDF: ${pdfUrl}` : null,
        '',
        `Manage billing: ${pricingUrl}`,
        '',
        '— CargoTrader'
      ]
        .filter(Boolean)
        .join('\n'),
      html: `
        <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;color:#1A2332">
          <h2 style="color:#1A3C5E">${recoveredFromPastDue ? 'Payment received' : 'Payment receipt'}</h2>
          <p>${
            recoveredFromPastDue
              ? `Thank you — we received your payment and restored paid features for <strong>${businessName}</strong>.`
              : `Thank you — we received a payment for <strong>${businessName}</strong>'s <strong>${planName}</strong> subscription.`
          }</p>
          ${amount ? `<p><strong>Amount paid:</strong> ${amount}</p>` : ''}
          ${paidAt ? `<p><strong>Date:</strong> ${paidAt}</p>` : ''}
          ${invoiceId ? `<p><strong>Invoice:</strong> ${invoiceId}</p>` : ''}
          ${
            hostedUrl
              ? `<p><a href="${hostedUrl}" style="display:inline-block;background:#E85D26;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">View invoice</a></p>`
              : `<p><a href="${pricingUrl}" style="display:inline-block;background:#E85D26;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Manage billing</a></p>`
          }
          ${pdfUrl ? `<p style="font-size:13px"><a href="${pdfUrl}">Download PDF receipt</a></p>` : ''}
        </div>`
    }));
    console.log(`[billing-email] payment_receipt → ${result.sent}/${result.total || 0} sent`);
    return result;
  } catch (err) {
    console.error('[billing-email] payment_receipt failed:', err.message);
    return { sent: 0, reason: 'error', error: err.message };
  }
}

/** Downgrade scheduled at period end, or applied immediately. */
export async function notifyPlanDowngrade(businessId, {
  fromPlanId,
  toPlanId,
  immediate = false,
  effectiveAt = null,
  reason = 'user'
} = {}) {
  const fromName = getPlan(fromPlanId || 'professional').name;
  const toName = getPlan(toPlanId || 'free').name;
  const when = formatDate(effectiveAt);

  const subject = immediate
    ? `Plan changed to ${toName} — ${reason === 'grace_expired' ? 'payment grace ended' : 'CargoTrader'}`
    : `Downgrade scheduled to ${toName}`;

  try {
    const result = await sendToBillingContacts(businessId, ({ businessName, pricingUrl }) => ({
      subject: `${subject} (${businessName})`,
      previewLog: `downgrade business=${businessId} ${fromPlanId}→${toPlanId} immediate=${immediate}`,
      text: [
        'Hello,',
        '',
        immediate
          ? reason === 'grace_expired'
            ? `The payment grace period for ${businessName} has ended. Your plan is now ${toName} (was ${fromName}).`
            : `${businessName}'s plan is now ${toName} (was ${fromName}).`
          : `A downgrade for ${businessName} from ${fromName} to ${toName} has been scheduled.`,
        !immediate && when ? `You keep ${fromName} access until ${when}.` : null,
        '',
        `You can upgrade again anytime: ${pricingUrl}`,
        '',
        '— CargoTrader'
      ]
        .filter(Boolean)
        .join('\n'),
      html: `
        <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;color:#1A2332">
          <h2 style="color:#1A3C5E">${immediate ? 'Plan updated' : 'Downgrade scheduled'}</h2>
          <p>${
            immediate
              ? reason === 'grace_expired'
                ? `The payment grace period for <strong>${businessName}</strong> has ended. Your plan is now <strong>${toName}</strong> (was ${fromName}).`
                : `<strong>${businessName}</strong>'s plan is now <strong>${toName}</strong> (was ${fromName}).`
              : `A downgrade for <strong>${businessName}</strong> from <strong>${fromName}</strong> to <strong>${toName}</strong> has been scheduled.`
          }</p>
          ${
            !immediate && when
              ? `<p>You keep <strong>${fromName}</strong> access until <strong>${when}</strong>.</p>`
              : ''
          }
          <p><a href="${pricingUrl}" style="display:inline-block;background:#E85D26;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">View plans</a></p>
        </div>`
    }));
    console.log(`[billing-email] downgrade → ${result.sent}/${result.total || 0} sent`);
    return result;
  } catch (err) {
    console.error('[billing-email] downgrade failed:', err.message);
    return { sent: 0, reason: 'error', error: err.message };
  }
}
