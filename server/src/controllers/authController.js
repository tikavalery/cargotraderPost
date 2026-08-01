import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import Business from '../models/Business.js';
import Store from '../models/Store.js';
import { ensureBusinessSubscription } from '../services/subscriptionService.js';
import ApiError, { asyncHandler } from '../utils/ApiError.js';
import { resolveEffectiveRole } from '../middleware/rbac.js';
import { storeDisplayName } from '../utils/clerkScope.js';
import { warehouseScopeLabels } from '../utils/warehouseScope.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  tokenExpiry,
  normalizeIdentifier
} from '../utils/tokens.js';
import { VALID_CURRENCIES } from '../constants/currencies.js';
import { verifyGoogleIdToken } from '../utils/googleAuth.js';
import {
  getGoogleClientId,
  isGoogleAuthConfigured,
  isGoogleClientSecret,
  isValidGoogleClientId
} from '../utils/googleClientId.js';
import {
  generateInviteToken,
  hashToken,
  sendPasswordResetEmail
} from '../services/emailService.js';
import { resolveSignupRole } from '../utils/platformAccess.js';

const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000;
const FORGOT_PASSWORD_MESSAGE =
  'If an account exists with that email, we sent password reset instructions.';

function formatUser(user, business) {
  const pub = user.toPublicJSON ? user.toPublicJSON() : user;
  if (business) {
    const membership = user.businesses?.find((b) => String(b.business) === String(business._id));
    const businessCurrency = business.currencies?.[0] || pub.preferredCurrency || 'XAF';
    pub.businessName = business.name;
    pub.country = business.country;
    pub.currencies = [businessCurrency];
    pub.preferredCurrency = businessCurrency;
    pub.currency = businessCurrency;
    pub.defaultBusinessId = String(business._id);
    pub.role = membership?.role || user.role;
    pub.assignedStoreId = membership?.assignedStoreId || '';
    pub.assignedStoreName = '';
    pub.assignedWarehouseIds = (membership?.assignedWarehouses || []).map((id) => String(id));
    pub.assignedWarehouseNames = [];
    pub.assignedWarehousesLabel = '';
  }
  return pub;
}

async function enrichUserScope(pub, businessId) {
  if (pub?.assignedStoreId && businessId) {
    const store = await Store.findOne({ business: businessId, storeId: pub.assignedStoreId }).lean();
    pub.assignedStoreName = storeDisplayName(store) || pub.assignedStoreId;
  }
  if (pub?.assignedWarehouseIds?.length && businessId) {
    pub.assignedWarehouseNames = await warehouseScopeLabels(businessId, pub.assignedWarehouseIds);
    pub.assignedWarehousesLabel = pub.assignedWarehouseNames.join(', ');
  }
  return pub;
}

async function enrichUserStore(pub, businessId) {
  return enrichUserScope(pub, businessId);
}

async function resolveDefaultBusiness(user) {
  if (user.defaultBusinessId) {
    const business = await Business.findById(user.defaultBusinessId);
    if (business) return business;
  }
  const firstId = user.businesses?.[0]?.business;
  if (!firstId) return null;
  const business = await Business.findById(firstId);
  if (business) {
    user.defaultBusinessId = business._id;
    await user.save();
  }
  return business;
}

async function createBusinessForUser(user, businessName, country, currency) {
  const code = VALID_CURRENCIES.includes(currency) ? currency : 'XAF';
  const business = await Business.create({
    name: businessName || `${user.name}'s Business`,
    owner: user._id,
    country: country || 'Cameroon',
    currencies: [code],
    members: [{ user: user._id, role: user.role }]
  });
  user.businesses.push({ business: business._id, role: user.role });
  user.defaultBusinessId = business._id;
  await user.save();
  await ensureBusinessSubscription(business._id);
  return business;
}

async function findUserByIdentifier(identifier) {
  const norm = normalizeIdentifier(identifier);
  const isEmail = norm.includes('@');
  if (isEmail) return User.findOne({ email: norm }).select('+password +refreshTokenHash');
  return User.findOne({
    $or: [{ phone: norm }, { phone: identifier.trim() }]
  }).select('+password +refreshTokenHash');
}

export const registerValidators = [
  body('name').trim().notEmpty().withMessage('Please enter your full name'),
  body('identifier').trim().notEmpty().withMessage('Please enter your email or phone number'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
];

export const register = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ApiError(400, errors.array()[0].msg);

  const { name, identifier, password, businessName, country } = req.body;
  const rawCurrency =
    req.body.currency ||
    (Array.isArray(req.body.currencies) ? req.body.currencies[0] : null) ||
    (Array.isArray(req.body.preferredCurrencies) ? req.body.preferredCurrencies[0] : null) ||
    'XAF';
  const currency = VALID_CURRENCIES.includes(rawCurrency) ? rawCurrency : 'XAF';

  const norm = normalizeIdentifier(identifier);
  const isEmail = norm.includes('@');
  const query = isEmail ? { email: norm } : { phone: norm };
  const existing = await User.findOne(query).select('+password +refreshTokenHash');
  if (existing) {
    if (!existing.isActive) {
      throw new ApiError(
        409,
        'This email was used before and the account is deactivated. Sign up with Google using the same email to reactivate, or use a different email.'
      );
    }
    throw new ApiError(409, 'An account with this email or phone already exists');
  }

  const user = await User.create({
    name: name.trim(),
    password,
    email: isEmail ? norm : undefined,
    phone: isEmail ? undefined : norm,
    role: resolveSignupRole(),
    countriesOperated: country ? [country] : ['Cameroon'],
    preferredCurrency: currency,
    preferredCurrencies: [currency],
    businesses: []
  });

  const business = await createBusinessForUser(user, businessName, country, currency);
  const effectiveRole = resolveEffectiveRole(user, business._id, user.role);
  const accessToken = signAccessToken({ id: user._id, role: effectiveRole }, true);
  const refreshToken = signRefreshToken({ id: user._id, role: effectiveRole });
  user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await user.save();

  res.status(201).json({
    ok: true,
    token: accessToken,
    refreshToken,
    user: formatUser(user, business),
    expiresAt: tokenExpiry(true)
  });
});

export const loginValidators = [
  body('identifier').trim().notEmpty().withMessage('Please enter your email or phone number'),
  body('password').notEmpty().withMessage('Please enter your password')
];

export const login = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ApiError(400, errors.array()[0].msg);

  const { identifier, password, rememberMe = false } = req.body;
  const user = await findUserByIdentifier(identifier);

  if (!user || !user.isActive) {
    throw new ApiError(401, 'Invalid email/phone or password');
  }

  if (!user.password && user.googleId) {
    throw new ApiError(401, 'This account uses Google sign-in. Please continue with Google.');
  }

  const passwordOk = await user.matchPassword(password);
  if (!passwordOk) throw new ApiError(401, 'Invalid email/phone or password');

  user.lastLoginAt = new Date();
  const business = await resolveDefaultBusiness(user);
  const effectiveRole = resolveEffectiveRole(user, business?._id, user.role);
  const accessToken = signAccessToken({ id: user._id, role: effectiveRole }, !!rememberMe);
  const refreshToken = signRefreshToken({ id: user._id, role: effectiveRole });
  user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await user.save();

  const pub = await enrichUserStore(formatUser(user, business), business?._id);
  res.json({
    ok: true,
    token: accessToken,
    refreshToken,
    user: pub,
    expiresAt: tokenExpiry(!!rememberMe)
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new ApiError(400, 'Refresh token required');

  const decoded = verifyRefreshToken(refreshToken);
  const user = await User.findById(decoded.id).select('+refreshTokenHash');
  if (!user || !user.refreshTokenHash || !user.isActive) throw new ApiError(401, 'Invalid refresh token');
  const valid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
  if (!valid) throw new ApiError(401, 'Invalid refresh token');

  const business = await resolveDefaultBusiness(user);
  const effectiveRole = resolveEffectiveRole(user, business?._id, user.role);
  const accessToken = signAccessToken({ id: user._id, role: effectiveRole }, true);
  const newRefreshToken = signRefreshToken({ id: user._id, role: effectiveRole });
  user.refreshTokenHash = await bcrypt.hash(newRefreshToken, 10);
  await user.save();

  res.json({
    ok: true,
    token: accessToken,
    refreshToken: newRefreshToken,
    expiresAt: tokenExpiry(true)
  });
});

export const googleConfig = asyncHandler(async (req, res) => {
  const clientId = getGoogleClientId();
  const configured = isGoogleAuthConfigured();
  let hint = null;

  if (!clientId) {
    hint = 'Add GOOGLE_CLIENT_ID to Railway Variables (web service), then redeploy';
  } else if (isGoogleClientSecret(clientId)) {
    hint = 'GOOGLE_CLIENT_ID is a client secret (GOCSPX-…). Use the OAuth Client ID ending in .apps.googleusercontent.com';
  } else if (!isValidGoogleClientId(clientId)) {
    hint = 'GOOGLE_CLIENT_ID format is invalid';
  }

  res.json({
    ok: true,
    configured,
    clientId: configured ? clientId : '',
    hint
  });
});

export const googleAuth = asyncHandler(async (req, res) => {
  const { credential, rememberMe = true, mode = 'login', businessName, country } = req.body;
  const rawCurrency =
    req.body.currency ||
    (Array.isArray(req.body.currencies) ? req.body.currencies[0] : null) ||
    'XAF';
  const currency = VALID_CURRENCIES.includes(rawCurrency) ? rawCurrency : 'XAF';

  if (!credential) throw new ApiError(400, 'Google credential is required');

  const payload = await verifyGoogleIdToken(credential);
  const googleId = payload.sub;
  const email = payload.email?.toLowerCase();
  const name = payload.name?.trim() || email?.split('@')[0] || 'Google User';

  if (!email) {
    throw new ApiError(400, 'Your Google account must have a verified email address');
  }

  let user = await User.findOne({
    $or: [{ googleId }, { email }]
  }).select('+password +refreshTokenHash');

  if (!user) {
    user = await User.create({
      name,
      email,
      googleId,
      authProvider: 'google',
      role: resolveSignupRole(),
      countriesOperated: country ? [country] : ['Cameroon'],
      preferredCurrency: currency,
      preferredCurrencies: [currency],
      businesses: []
    });

    await createBusinessForUser(user, businessName, country, currency);
  } else {
    // Previously deactivated users (e.g. removed from a business) can sign up again
    // with Google to reactivate and create/join a business.
    if (!user.isActive) {
      if (mode !== 'register') {
        throw new ApiError(
          403,
          'This account has been deactivated. Use Create Account / Sign up with Google to reactivate, or ask your business owner to restore access.'
        );
      }
      user.isActive = true;
    }

    if (!user.googleId) {
      user.googleId = googleId;
      if (!user.password) user.authProvider = 'google';
    }

    if (!user.name && name) user.name = name;

    if (!user.businesses?.length) {
      // Fresh business for returning owners who were removed from their last company
      user.role = resolveSignupRole();
      await createBusinessForUser(user, businessName, country, currency);
    }
  }

  user.lastLoginAt = new Date();
  const business = await resolveDefaultBusiness(user);
  const effectiveRole = resolveEffectiveRole(user, business?._id, user.role);
  const accessToken = signAccessToken({ id: user._id, role: effectiveRole }, !!rememberMe);
  const refreshToken = signRefreshToken({ id: user._id, role: effectiveRole });
  user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await user.save();

  const pub = await enrichUserStore(formatUser(user, business), business?._id);

  res.json({
    ok: true,
    token: accessToken,
    refreshToken,
    user: pub,
    expiresAt: tokenExpiry(!!rememberMe)
  });
});

export const forgotPasswordValidators = [
  body('email').trim().notEmpty().withMessage('Please enter your email address').isEmail().withMessage('Enter a valid email address')
];

export const forgotPassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ApiError(400, errors.array()[0].msg);

  const email = normalizeIdentifier(req.body.email);
  const user = await User.findOne({ email }).select(
    '+passwordResetTokenHash +passwordResetExpires'
  );

  if (user?.isActive && user.email) {
    const token = generateInviteToken();
    user.passwordResetTokenHash = hashToken(token);
    user.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);
    await user.save();

    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
    const resetUrl = `${clientUrl}/reset-password/${token}`;
    const emailResult = await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl
    });

    const payload = { ok: true, message: FORGOT_PASSWORD_MESSAGE };
    if (process.env.NODE_ENV !== 'production' && !emailResult.sent && emailResult.preview) {
      payload.devResetUrl = emailResult.preview;
    }
    return res.json(payload);
  }

  res.json({ ok: true, message: FORGOT_PASSWORD_MESSAGE });
});

export const validateResetToken = asyncHandler(async (req, res) => {
  const { token } = req.params;
  if (!token) return res.json({ ok: true, valid: false });

  const user = await User.findOne({
    passwordResetTokenHash: hashToken(token),
    passwordResetExpires: { $gt: new Date() }
  });

  res.json({ ok: true, valid: Boolean(user) });
});

export const resetPasswordValidators = [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
];

export const resetPassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ApiError(400, errors.array()[0].msg);

  const { token, password } = req.body;
  const user = await User.findOne({
    passwordResetTokenHash: hashToken(token),
    passwordResetExpires: { $gt: new Date() }
  }).select('+passwordResetTokenHash +passwordResetExpires +refreshTokenHash');

  if (!user || !user.isActive) {
    throw new ApiError(400, 'Invalid or expired reset link. Request a new one.');
  }

  user.password = password;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokenHash = undefined;
  if (user.googleId) user.authProvider = 'local';
  await user.save();

  res.json({ ok: true, message: 'Password updated. You can sign in now.' });
});

export const me = asyncHandler(async (req, res) => {
  const business = await resolveDefaultBusiness(req.userDoc);
  const pub = await enrichUserStore(formatUser(req.userDoc, business), business?._id);
  res.json({ ok: true, user: pub });
});

export const logout = asyncHandler(async (req, res) => {
  if (req.userDoc) {
    req.userDoc.refreshTokenHash = undefined;
    await req.userDoc.save();
  }
  res.json({ ok: true, message: 'Logged out' });
});
