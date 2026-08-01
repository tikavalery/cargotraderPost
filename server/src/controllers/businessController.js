import Business from '../models/Business.js';
import User from '../models/User.js';
import ApiError, { asyncHandler } from '../utils/ApiError.js';
import { assertWithinLimit, countBusinessUsers } from '../services/subscriptionService.js';
import { INVITABLE_ROLES, ROLES } from '../constants/roles.js';
import { isPlatformAdmin, isBusinessMember } from '../utils/platformAccess.js';
import { purgeBusinessAccount } from '../services/purgeBusinessAccount.service.js';
import { findBusinessesForUser } from '../utils/userBusinessQuery.js';

export const listBusinesses = asyncHandler(async (req, res) => {
  const businesses = isPlatformAdmin(req.userDoc)
    ? await Business.find({})
    : await findBusinessesForUser(req.userDoc._id);
  res.json({ ok: true, data: businesses });
});

export const getBusiness = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.params.id);
  if (!business) throw new ApiError(404, 'Business not found');
  if (!isBusinessMember(req.userDoc, business)) {
    throw new ApiError(403, 'Not authorized to view this business');
  }
  res.json({ ok: true, data: business });
});

export const createBusiness = asyncHandler(async (req, res) => {
  const name = String(req.body.name || req.body.businessName || '').trim();
  if (!name) throw new ApiError(400, 'Business name is required');

  const currency = req.body.currency || req.userDoc.preferredCurrency || 'XAF';
  const business = await Business.create({
    name,
    country: req.body.country || 'Cameroon',
    currencies: [currency],
    owner: req.userDoc._id,
    members: [{ user: req.userDoc._id, role: ROLES.BUSINESS_OWNER }]
  });
  req.userDoc.businesses.push({ business: business._id, role: ROLES.BUSINESS_OWNER });
  if (!req.userDoc.defaultBusinessId) req.userDoc.defaultBusinessId = business._id;
  await req.userDoc.save();
  res.status(201).json({ ok: true, data: business });
});

export const updateBusiness = asyncHandler(async (req, res) => {
  const allowed = {};
  if (req.body.name != null) allowed.name = String(req.body.name).trim();
  if (req.body.country != null) allowed.country = req.body.country;
  if (req.body.currency != null) allowed.currencies = [req.body.currency];
  if (Array.isArray(req.body.currencies)) allowed.currencies = req.body.currencies;
  if (req.body.address != null) allowed.address = req.body.address;
  if (req.body.taxId != null) allowed.taxId = req.body.taxId;

  const business = await Business.findOneAndUpdate(
    { _id: req.params.id, owner: req.userDoc._id },
    allowed,
    { new: true }
  );
  if (!business) throw new ApiError(404, 'Business not found');
  res.json({ ok: true, data: business });
});

export const addMember = asyncHandler(async (req, res) => {
  const { userId, role } = req.body;
  if (!userId) throw new ApiError(400, 'userId is required');
  const safeRole = INVITABLE_ROLES.includes(role) ? role : ROLES.STORE_CLERK;

  const business = await Business.findOne({ _id: req.params.id, owner: req.userDoc._id });
  if (!business) throw new ApiError(404, 'Business not found');

  const alreadyMember = business.members.some((m) => String(m.user) === String(userId));
  if (alreadyMember) {
    return res.json({ ok: true, data: business, message: 'User is already a member' });
  }

  await assertWithinLimit(business._id, 'users', () => countBusinessUsers(business._id));

  business.members.push({ user: userId, role: safeRole });
  await business.save();
  res.json({ ok: true, data: business });
});

/**
 * Permanently delete the business and all of its data.
 * Only the business owner may call this. Requires confirmName === business.name.
 * Local (password) accounts must also send the correct password.
 */
export const deleteBusiness = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.params.id);
  if (!business) throw new ApiError(404, 'Business not found');

  if (String(business.owner) !== String(req.userDoc._id)) {
    throw new ApiError(403, 'Only the business owner can delete this account');
  }

  const confirmName = String(req.body?.confirmName || '').trim();
  if (!confirmName || confirmName.toLowerCase() !== String(business.name || '').trim().toLowerCase()) {
    throw new ApiError(400, 'Type the exact business name to confirm deletion');
  }

  const owner = await User.findById(req.userDoc._id).select('+password');
  if (!owner) throw new ApiError(401, 'Not authorized');

  const isLocalAuth = owner.authProvider !== 'google' && Boolean(owner.password);
  if (isLocalAuth) {
    const password = String(req.body?.password || '');
    if (!password) throw new ApiError(400, 'Password is required to delete your account');
    const ok = await owner.matchPassword(password);
    if (!ok) throw new ApiError(401, 'Incorrect password');
  }

  const result = await purgeBusinessAccount(business._id);

  res.json({
    ok: true,
    message: 'Business account and all related data have been permanently deleted',
    data: result
  });
});
