import { isValidId } from '../utils/ids.js';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Business from '../models/Business.js';
import StaffInvitation from '../models/StaffInvitation.js';
import ApiError, { asyncHandler } from '../utils/ApiError.js';
import { INVITABLE_ROLES, ROLES, PERMISSIONS, HIDDEN_STAFF_ROLES } from '../constants/roles.js';
import { normalizeIdentifier } from '../utils/tokens.js';
import {
  generateInviteToken,
  hashInviteToken,
  sendStaffInviteEmail
} from '../services/emailService.js';
import { validateClerkStoreAssignment, storeDisplayName } from '../utils/clerkScope.js';
import {
  validateWarehouseWorkerAssignment,
  warehouseDisplayName,
  warehouseScopeLabels
} from '../utils/warehouseScope.js';
import Store from '../models/Store.js';
import { Warehouse } from '../models/Warehouse.js';
import {
  signAccessToken,
  signRefreshToken,
  tokenExpiry
} from '../utils/tokens.js';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function maskIdentifier(email, phone) {
  if (email) {
    const [local, domain] = email.split('@');
    const masked = local.length <= 2 ? '**' : `${local.slice(0, 2)}***`;
    return `${masked}@${domain}`;
  }
  if (phone && phone.length > 4) return `${phone.slice(0, 3)}***${phone.slice(-2)}`;
  return phone || '';
}

function formatInvite(inv, inviter, storeMap = {}, warehouseMap = {}) {
  const store = storeMap[inv.assignedStoreId];
  const whIds = (inv.assignedWarehouses || []).map((id) => String(id));
  const assignedWarehouseNames = whIds
    .map((id) => warehouseDisplayName(warehouseMap[id]))
    .filter(Boolean);
  return {
    id: String(inv._id),
    email: inv.email || '',
    phone: inv.phone || '',
    role: inv.role,
    assignedStoreId: inv.assignedStoreId || '',
    assignedStoreName: storeDisplayName(store) || (inv.assignedStoreId || ''),
    assignedWarehouseIds: whIds,
    assignedWarehouseNames,
    assignedWarehousesLabel: assignedWarehouseNames.join(', ') || '',
    status: inv.status,
    expiresAt: inv.expiresAt,
    createdAt: inv.createdAt,
    invitedBy: inviter
      ? { id: String(inviter._id), name: inviter.name }
      : inv.invitedBy
        ? { id: String(inv.invitedBy) }
        : null
  };
}

async function assertCanManageUsers(req) {
  const role = req.businessRole || req.userDoc?.role;
  if (!(PERMISSIONS.manageUsers || []).includes(role)) {
    throw new ApiError(403, 'You do not have permission to manage staff');
  }
}

/** Real user id for invitedBy. */
async function resolveInviter(req) {
  const userId = req.userDoc?._id;
  if (userId && isValidId(userId)) {
    return { id: userId, name: req.userDoc?.name || 'Team admin' };
  }
  throw new ApiError(403, 'Sign in to invite staff');
}

export const inviteValidators = [
  body('identifier').trim().notEmpty().withMessage('Email or phone is required'),
  body('role')
    .trim()
    .notEmpty()
    .withMessage('Role is required')
    .isIn(INVITABLE_ROLES)
    .withMessage('Invalid role for invitation')
];

export const acceptValidators = [
  body('token').trim().notEmpty().withMessage('Invitation token is required'),
  body('name').trim().notEmpty().withMessage('Please enter your full name'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
];

export const listInvitations = asyncHandler(async (req, res) => {
  await assertCanManageUsers(req);
  const [invites, stores, warehouses] = await Promise.all([
    StaffInvitation.find({ business: req.businessId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('invitedBy', 'name email'),
    Store.find({ business: req.businessId }).lean(),
    Warehouse.find({ business: req.businessId }).lean()
  ]);
  const storeMap = Object.fromEntries(stores.map((s) => [s.storeId, s]));
  const warehouseMap = Object.fromEntries(warehouses.map((w) => [String(w._id), w]));
  res.json({
    ok: true,
    data: invites
      .map((inv) => formatInvite(inv, inv.invitedBy, storeMap, warehouseMap))
      .filter((inv) => !HIDDEN_STAFF_ROLES.includes(inv.role))
  });
});

export const createInvitation = asyncHandler(async (req, res) => {
  await assertCanManageUsers(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ApiError(400, errors.array()[0].msg);

  const { identifier, role, assignedStoreId, assignedWarehouseIds } = req.body;
  const norm = normalizeIdentifier(identifier);
  const isEmail = norm.includes('@');
  const email = isEmail ? norm : undefined;
  const phone = isEmail ? undefined : norm;

  const existingUserQuery = isEmail ? { email: norm } : { phone: norm };
  if (await User.findOne(existingUserQuery)) {
    throw new ApiError(409, 'A user with this email or phone already exists');
  }

  const pendingQuery = {
    business: req.businessId,
    status: 'pending',
    expiresAt: { $gt: new Date() },
    ...(isEmail ? { email: norm } : { phone: norm })
  };
  if (await StaffInvitation.findOne(pendingQuery)) {
    throw new ApiError(409, 'A pending invitation already exists for this contact');
  }

  const business = await Business.findById(req.businessId);
  if (!business) throw new ApiError(404, 'Business not found');

  const inviter = await resolveInviter(req);

  const storeId = await validateClerkStoreAssignment(
    req.businessId,
    role,
    role === ROLES.STORE_CLERK ? assignedStoreId : ''
  );
  const warehouseIds = await validateWarehouseWorkerAssignment(
    req.businessId,
    role,
    role === ROLES.WAREHOUSE_WORKER ? assignedWarehouseIds : []
  );

  const rawToken = generateInviteToken();
  const tokenHash = hashInviteToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const invitation = await StaffInvitation.create({
    business: req.businessId,
    invitedBy: inviter.id,
    email,
    phone,
    role,
    assignedStoreId: storeId,
    assignedWarehouses: warehouseIds,
    tokenHash,
    expiresAt
  });

  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
  const inviteUrl = `${clientUrl}/invite/${rawToken}`;

  let emailResult = { sent: false };
  if (isEmail) {
    emailResult = await sendStaffInviteEmail({
      to: norm,
      inviteUrl,
      businessName: business.name,
      role,
      inviterName: inviter.name
    });
  } else {
    console.log('\n[invite] Phone invitation (share link manually):');
    console.log(`  Phone: ${phone}`);
    console.log(`  Link: ${inviteUrl}\n`);
  }

  res.status(201).json({
    ok: true,
    data: formatInvite(invitation, req.userDoc),
    inviteUrl: emailResult.sent ? undefined : inviteUrl,
    emailSent: emailResult.sent,
    message: isEmail
      ? emailResult.sent
        ? 'Invitation email sent'
        : emailResult.reason === 'send_failed'
          ? 'Invitation created — email could not be sent. Copy the registration link below.'
          : 'Invitation created — copy the registration link below (email not configured)'
      : 'Invitation created — share the registration link with the user'
  });
});

export const getInvitation = asyncHandler(async (req, res) => {
  await assertCanManageUsers(req);
  const invitation = await StaffInvitation.findOne({
    _id: req.params.id,
    business: req.businessId
  }).populate('invitedBy', 'name email');
  if (!invitation) throw new ApiError(404, 'Invitation not found');
  res.json({ ok: true, data: formatInvite(invitation, invitation.invitedBy) });
});

export const updateInvitation = asyncHandler(async (req, res) => {
  await assertCanManageUsers(req);
  const { role, assignedStoreId, assignedWarehouseIds } = req.body;
  if (!role || !INVITABLE_ROLES.includes(role)) {
    throw new ApiError(400, 'Invalid role');
  }
  const invitation = await StaffInvitation.findOne({
    _id: req.params.id,
    business: req.businessId,
    status: 'pending'
  });
  if (!invitation) throw new ApiError(404, 'Pending invitation not found');
  invitation.role = role;
  const storeId = await validateClerkStoreAssignment(
    req.businessId,
    role,
    role === ROLES.STORE_CLERK ? assignedStoreId ?? invitation.assignedStoreId : ''
  );
  const warehouseIds = await validateWarehouseWorkerAssignment(
    req.businessId,
    role,
    role === ROLES.WAREHOUSE_WORKER
      ? assignedWarehouseIds ?? invitation.assignedWarehouses
      : []
  );
  invitation.assignedStoreId = storeId;
  invitation.assignedWarehouses = warehouseIds;
  await invitation.save();
  const [stores, warehouses] = await Promise.all([
    Store.find({ business: req.businessId }).lean(),
    Warehouse.find({ business: req.businessId }).lean()
  ]);
  const storeMap = Object.fromEntries(stores.map((s) => [s.storeId, s]));
  const warehouseMap = Object.fromEntries(warehouses.map((w) => [String(w._id), w]));
  res.json({ ok: true, data: formatInvite(invitation, req.userDoc, storeMap, warehouseMap) });
});

export const revokeInvitation = asyncHandler(async (req, res) => {
  await assertCanManageUsers(req);
  const invitation = await StaffInvitation.findOne({
    _id: req.params.id,
    business: req.businessId,
    status: 'pending'
  });
  if (!invitation) throw new ApiError(404, 'Pending invitation not found');
  invitation.status = 'revoked';
  await invitation.save();
  res.json({ ok: true, data: formatInvite(invitation) });
});

export const resendInvitation = asyncHandler(async (req, res) => {
  await assertCanManageUsers(req);
  const invitation = await StaffInvitation.findOne({
    _id: req.params.id,
    business: req.businessId,
    status: 'pending'
  });
  if (!invitation) throw new ApiError(404, 'Pending invitation not found');

  const rawToken = generateInviteToken();
  invitation.tokenHash = hashInviteToken(rawToken);
  invitation.expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await invitation.save();

  const business = await Business.findById(req.businessId);
  const inviter = await resolveInviter(req);
  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
  const inviteUrl = `${clientUrl}/invite/${rawToken}`;

  let emailSent = false;
  if (invitation.email) {
    const result = await sendStaffInviteEmail({
      to: invitation.email,
      inviteUrl,
      businessName: business?.name || 'Your business',
      role: invitation.role,
      inviterName: inviter.name
    });
    emailSent = result.sent;
  }

  res.json({
    ok: true,
    data: formatInvite(invitation, req.userDoc),
    inviteUrl: emailSent ? undefined : inviteUrl,
    emailSent,
    message: invitation.email
      ? emailSent
        ? 'Invitation resent'
        : 'New link generated — copy and share it (email could not be sent)'
      : 'New link generated — share with the user'
  });
});

export const previewInvitation = asyncHandler(async (req, res) => {
  const tokenHash = hashInviteToken(req.params.token);
  const invitation = await StaffInvitation.findOne({ tokenHash, status: 'pending' });
  if (!invitation || invitation.expiresAt <= new Date()) {
    throw new ApiError(404, 'Invitation not found or expired');
  }

  const business = await Business.findById(invitation.business).select('name country');
  res.json({
    ok: true,
    data: {
      businessName: business?.name || 'Business',
      country: business?.country || 'Cameroon',
      role: invitation.role,
      identifier: maskIdentifier(invitation.email, invitation.phone),
      expiresAt: invitation.expiresAt
    }
  });
});

export const acceptInvitation = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ApiError(400, errors.array()[0].msg);

  const { token, name, password } = req.body;
  const tokenHash = hashInviteToken(token);
  const invitation = await StaffInvitation.findOne({ tokenHash, status: 'pending' });
  if (!invitation || invitation.expiresAt <= new Date()) {
    throw new ApiError(400, 'Invitation not found or expired');
  }
  if (!INVITABLE_ROLES.includes(invitation.role)) {
    throw new ApiError(400, 'This invitation role is no longer valid — ask your admin to send a new invite');
  }

  const existingQuery = invitation.email
    ? { email: invitation.email }
    : { phone: invitation.phone };
  if (await User.findOne(existingQuery)) {
    throw new ApiError(409, 'An account with this email or phone already exists');
  }

  const business = await Business.findById(invitation.business);
  if (!business) throw new ApiError(404, 'Business no longer exists');

  const user = await User.create({
    name: name.trim(),
    password,
    email: invitation.email,
    phone: invitation.phone,
    role: invitation.role,
    countriesOperated: business.country ? [business.country] : ['Cameroon'],
    preferredCurrency: business.currencies?.[0] || 'XAF',
    preferredCurrencies: business.currencies?.length ? business.currencies : ['XAF'],
    businesses: [
      {
        business: business._id,
        role: invitation.role,
        assignedStoreId: invitation.assignedStoreId || '',
        assignedWarehouses: invitation.assignedWarehouses || []
      }
    ],
    defaultBusinessId: business._id
  });

  business.members.push({ user: user._id, role: invitation.role });
  await business.save();

  invitation.status = 'accepted';
  invitation.acceptedAt = new Date();
  invitation.acceptedUser = user._id;
  await invitation.save();

  const accessToken = signAccessToken({ id: user._id, role: user.role }, true);
  const refreshToken = signRefreshToken({ id: user._id, role: user.role });
  user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  user.lastLoginAt = new Date();
  await user.save();

  const pub = user.toPublicJSON();
  pub.businessName = business.name;
  pub.country = business.country;
  pub.defaultBusinessId = String(business._id);
  pub.role = invitation.role;
  pub.assignedStoreId = invitation.assignedStoreId || '';
  const store = invitation.assignedStoreId
    ? await Store.findOne({ business: business._id, storeId: invitation.assignedStoreId }).lean()
    : null;
  pub.assignedStoreName = storeDisplayName(store) || pub.assignedStoreId;
  pub.assignedWarehouseIds = (invitation.assignedWarehouses || []).map((id) => String(id));
  pub.assignedWarehouseNames = await warehouseScopeLabels(business._id, pub.assignedWarehouseIds);
  pub.assignedWarehousesLabel = pub.assignedWarehouseNames.join(', ');

  res.status(201).json({
    ok: true,
    token: accessToken,
    refreshToken,
    user: pub,
    expiresAt: tokenExpiry(true),
    message: 'Account created successfully'
  });
});

export const listInvitableRoles = asyncHandler(async (req, res) => {
  res.json({ ok: true, data: INVITABLE_ROLES });
});
