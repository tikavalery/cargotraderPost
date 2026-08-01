import ApiError from '../utils/ApiError.js';
import { PERMISSIONS } from '../constants/roles.js';

/** Role for the active business (membership wins over global User.role). */
export function resolveEffectiveRole(userDoc, businessId, jwtRole) {
  if (!userDoc) return jwtRole || '';
  if (businessId && userDoc.businesses?.length) {
    const membership = userDoc.businesses.find((b) => String(b.business) === String(businessId));
    if (membership?.role) return membership.role;
  }
  return userDoc.role || jwtRole || '';
}

function resolveRole(req) {
  return req.businessRole || req.userDoc?.role || req.user?.role;
}

/**
 * RBAC — allow if user's business role or global role matches allowed list
 */
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    const role = resolveRole(req);
    if (allowedRoles.includes(role)) return next();
    return next(new ApiError(403, 'Forbidden — insufficient permissions'));
  };
}

/** Authorize by permission group key from PERMISSIONS constant */
export function authorizePermission(permissionKey) {
  const allowed = PERMISSIONS[permissionKey] || [];
  return authorize(...allowed);
}

/** Allow if the role has any of the listed permissions */
export function authorizeAnyPermission(...permissionKeys) {
  return (req, res, next) => {
    const role = resolveRole(req);
    const ok = permissionKeys.some((key) => (PERMISSIONS[key] || []).includes(role));
    if (ok) return next();
    return next(new ApiError(403, 'Forbidden — insufficient permissions'));
  };
}
