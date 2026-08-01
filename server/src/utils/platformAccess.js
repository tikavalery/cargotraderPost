import { ROLES } from '../constants/roles.js';

/**
 * Platform operators (cross-tenant). Never grant via public register/invite.
 * Set PLATFORM_ADMIN_EMAILS=ops@you.com,admin@you.com in production.
 */
export function isPlatformAdmin(userDoc) {
  if (!userDoc) return false;
  const allow = String(process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!allow.length) return false;
  const email = String(userDoc.email || '').trim().toLowerCase();
  return Boolean(email && allow.includes(email));
}

/** Roles allowed on public signup (register / Google). Ignores client-supplied Admin. */
export function resolveSignupRole() {
  return ROLES.BUSINESS_OWNER;
}

export function userBelongsToBusiness(userDoc, businessId) {
  if (!userDoc || !businessId) return false;
  const id = String(businessId);
  if (String(userDoc.defaultBusinessId || '') === id) return true;
  return (userDoc.businesses || []).some((b) => String(b.business) === id);
}

export function isBusinessMember(userDoc, business) {
  if (!userDoc || !business) return false;
  if (isPlatformAdmin(userDoc)) return true;
  if (String(business.owner) === String(userDoc._id)) return true;
  return (business.members || []).some((m) => String(m.user) === String(userDoc._id));
}
