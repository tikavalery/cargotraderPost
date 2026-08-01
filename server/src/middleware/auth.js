import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { resolveEffectiveRole } from '../middleware/rbac.js';
import { isDbReady, isMongoError, mongoErrorMessage } from '../config/db.js';
import { isPlatformAdmin } from '../utils/platformAccess.js';

/** Verify JWT and attach req.user */
export function protect(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Not authorized — no token'));
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    if (decoded.type && decoded.type !== 'access') {
      return next(new ApiError(401, 'Invalid access token'));
    }
    if (decoded.bypass || decoded.id === 'guest') {
      return next(new ApiError(401, 'Guest access is no longer supported — please sign in'));
    }
    req.user = {
      id: decoded.id,
      role: decoded.role,
      name: decoded.name,
      email: decoded.email
    };
    next();
  } catch {
    next(new ApiError(401, 'Not authorized — invalid or expired token'));
  }
}

/** Load full user document */
export async function attachUser(req, res, next) {
  try {
    if (!isDbReady()) {
      return next(new ApiError(503, mongoErrorMessage()));
    }
    const user = await User.findById(req.user.id).select('-password -refreshTokenHash');
    if (!user || !user.isActive) return next(new ApiError(401, 'User not found or inactive'));
    req.userDoc = user;
    next();
  } catch (err) {
    if (isMongoError(err)) return next(new ApiError(503, mongoErrorMessage(err)));
    next(new ApiError(500, 'Failed to load user'));
  }
}

/** Resolve active business from header or query */
export async function businessContext(req, res, next) {
  const headerBusinessId = req.headers['x-business-id'] || req.query.businessId;
  const defaultId = req.userDoc?.defaultBusinessId || null;

  const applyBusiness = (businessId) => {
    req.businessId = businessId;
    req.businessRole = resolveEffectiveRole(req.userDoc, businessId, req.user?.role);
  };

  if (!headerBusinessId) {
    applyBusiness(defaultId);
    return next();
  }

  const membership = req.userDoc?.businesses?.find(
    (b) => String(b.business) === String(headerBusinessId)
  );
  // Cross-tenant switch only for allowlisted platform operators (PLATFORM_ADMIN_EMAILS).
  if (!membership && !isPlatformAdmin(req.userDoc)) {
    applyBusiness(defaultId);
    return next();
  }

  applyBusiness(headerBusinessId);
  next();
}

export function requireBusiness(req, res, next) {
  if (!req.businessId) {
    return next(new ApiError(400, 'Business context required — set X-Business-Id header or businessId query'));
  }
  next();
}
