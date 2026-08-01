import User from '../models/User.js';
import Business from '../models/Business.js';
import Store from '../models/Store.js';
import ApiError, { asyncHandler } from '../utils/ApiError.js';
import { INVITABLE_ROLES, ROLES, PERMISSIONS, HIDDEN_STAFF_ROLES } from '../constants/roles.js';
import { normalizeCurrency, isValidCurrency } from '../constants/currencies.js';
import { assertCanModifyStaffTarget } from '../utils/staffAccess.js';
import { storeDisplayName, validateClerkStoreAssignment } from '../utils/clerkScope.js';
import {
  warehouseDisplayName,
  validateWarehouseWorkerAssignment
} from '../utils/warehouseScope.js';
import { Warehouse } from '../models/Warehouse.js';
import { findUsersByBusinessMembership } from '../utils/userBusinessQuery.js';

function formatUserRecord(user, businessId, storeMap = {}, warehouseMap = {}) {
  const membership = user.businesses?.find((b) => String(b.business) === String(businessId));
  const assignedStoreId = membership?.assignedStoreId || '';
  const store = storeMap[assignedStoreId];
  const assignedWarehouseIds = (membership?.assignedWarehouses || []).map((id) => String(id));
  const assignedWarehouseNames = assignedWarehouseIds
    .map((id) => warehouseDisplayName(warehouseMap[id]))
    .filter(Boolean);
  return {
    id: String(user._id),
    name: user.name,
    email: user.email || '',
    phone: user.phone || '',
    role: membership?.role || user.role,
    assignedStoreId,
    assignedStoreName: storeDisplayName(store) || (assignedStoreId ? assignedStoreId : ''),
    assignedWarehouseIds,
    assignedWarehouseNames,
    assignedWarehousesLabel: assignedWarehouseNames.join(', ') || '',
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt
  };
}
export const listUsers = asyncHandler(async (req, res) => {
  const [users, stores, warehouses] = await Promise.all([
    findUsersByBusinessMembership(req.businessId, { lean: true }),
    Store.find({ business: req.businessId }).lean(),
    Warehouse.find({ business: req.businessId }).lean()
  ]);
  const storeMap = Object.fromEntries(stores.map((s) => [s.storeId, s]));
  const warehouseMap = Object.fromEntries(warehouses.map((w) => [String(w._id), w]));
  const data = users
    .map((u) => formatUserRecord(u, req.businessId, storeMap, warehouseMap))
    .filter((u) => !HIDDEN_STAFF_ROLES.includes(u.role));
  res.json({ ok: true, data });
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password -refreshTokenHash');
  if (!user) throw new ApiError(404, 'User not found');
  const isMember = user.businesses.some((b) => String(b.business) === String(req.businessId));
  if (!isMember) throw new ApiError(404, 'User not found in this business');
  const stores = await Store.find({ business: req.businessId }).lean();
  const warehouses = await Warehouse.find({ business: req.businessId }).lean();
  const storeMap = Object.fromEntries(stores.map((s) => [s.storeId, s]));
  const warehouseMap = Object.fromEntries(warehouses.map((w) => [String(w._id), w]));
  res.json({ ok: true, data: formatUserRecord(user, req.businessId, storeMap, warehouseMap) });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  assertCanModifyStaffTarget(req, user._id);

  const isMember = user.businesses.some((b) => String(b.business) === String(req.businessId));
  if (!isMember) throw new ApiError(404, 'User not found in this business');

  const business = await Business.findById(req.businessId);
  if (!business) throw new ApiError(404, 'Business not found');

  if (String(business.owner) === String(user._id) && req.body.role && req.body.role !== user.role) {
    throw new ApiError(400, 'Cannot change the business owner role');
  }

  const { role, isActive, name, assignedStoreId, assignedWarehouseIds } = req.body;
  const membership = user.businesses.find((b) => String(b.business) === String(req.businessId));
  const nextRole = role !== undefined ? role : membership?.role || user.role;
  let nextStoreId =
    assignedStoreId !== undefined ? String(assignedStoreId || '').trim() : membership?.assignedStoreId || '';
  let nextWarehouseIds = membership?.assignedWarehouses?.map((id) => String(id)) || [];

  if (role !== undefined) {
    if (!INVITABLE_ROLES.includes(role) && role !== 'Business Owner') {
      throw new ApiError(400, 'Invalid role');
    }
    if (role === 'Business Owner') {
      throw new ApiError(400, 'Use business transfer to assign Business Owner');
    }
    user.role = role;
    if (membership) membership.role = role;
    const member = business.members.find((m) => String(m.user) === String(user._id));
    if (member) member.role = role;
    if (role !== ROLES.STORE_CLERK) nextStoreId = '';
    if (role !== ROLES.WAREHOUSE_WORKER) nextWarehouseIds = [];
  }

  if (assignedStoreId !== undefined) {
    nextStoreId = String(assignedStoreId || '').trim();
  }
  if (assignedWarehouseIds !== undefined) {
    nextWarehouseIds = Array.isArray(assignedWarehouseIds) ? assignedWarehouseIds : [];
  }

  if (nextRole === ROLES.STORE_CLERK) {
    nextStoreId = await validateClerkStoreAssignment(req.businessId, nextRole, nextStoreId);
    nextWarehouseIds = [];
  } else if (nextRole === ROLES.WAREHOUSE_WORKER) {
    nextWarehouseIds = await validateWarehouseWorkerAssignment(
      req.businessId,
      nextRole,
      nextWarehouseIds
    );
    nextStoreId = '';
  } else {
    nextStoreId = '';
    nextWarehouseIds = [];
  }

  if (membership) {
    membership.assignedStoreId = nextStoreId;
    membership.assignedWarehouses = nextWarehouseIds;
  }

  if (typeof isActive === 'boolean') {
    if (String(user._id) === String(req.userDoc._id)) {
      throw new ApiError(400, 'You cannot deactivate your own account');
    }
    if (String(business.owner) === String(user._id)) {
      throw new ApiError(400, 'Cannot deactivate the business owner');
    }
    user.isActive = isActive;
  }

  if (name?.trim()) user.name = name.trim();

  await user.save();
  if (role !== undefined) await business.save();

  const stores = await Store.find({ business: req.businessId }).lean();
  const warehouses = await Warehouse.find({ business: req.businessId }).lean();
  const storeMap = Object.fromEntries(stores.map((s) => [s.storeId, s]));
  const warehouseMap = Object.fromEntries(warehouses.map((w) => [String(w._id), w]));
  res.json({
    ok: true,
    data: formatUserRecord(user, req.businessId, storeMap, warehouseMap)
  });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  assertCanModifyStaffTarget(req, user._id);

  const business = await Business.findById(req.businessId);
  if (!business) throw new ApiError(404, 'Business not found');

  if (String(business.owner) === String(user._id)) {
    throw new ApiError(400, 'Cannot remove the business owner');
  }
  if (String(user._id) === String(req.userDoc._id)) {
    throw new ApiError(400, 'You cannot remove your own account');
  }

  const isMember = user.businesses.some((b) => String(b.business) === String(req.businessId));
  if (!isMember) throw new ApiError(404, 'User not found in this business');

  await Business.updateOne(
    { _id: req.businessId },
    { $pull: { members: { user: user._id } } }
  );

  await User.updateOne(
    { _id: user._id },
    { $pull: { businesses: { business: req.businessId } } }
  );

  const updated = await User.findById(user._id);
  if (String(updated.defaultBusinessId) === String(req.businessId)) {
    updated.defaultBusinessId = updated.businesses[0]?.business || undefined;
  }
  if (!updated.businesses.length) {
    updated.isActive = false;
    updated.refreshTokenHash = undefined;
  }
  await updated.save();

  res.json({ ok: true, message: 'User removed from business' });
});

export const getProfile = asyncHandler(async (req, res) => {
  res.json({ ok: true, user: req.userDoc.toPublicJSON() });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, countriesOperated, preferredCurrencies, preferredCurrency } = req.body;
  if (name) req.userDoc.name = name;
  if (phone) req.userDoc.phone = phone;
  if (countriesOperated) req.userDoc.countriesOperated = countriesOperated;
  if (preferredCurrency) {
    if (!isValidCurrency(preferredCurrency)) throw new ApiError(400, 'Unsupported currency');
    const code = normalizeCurrency(preferredCurrency);
    req.userDoc.preferredCurrency = code;
    req.userDoc.preferredCurrencies = [code];
  } else if (preferredCurrencies) {
    const next = Array.isArray(preferredCurrencies) ? preferredCurrencies[0] : preferredCurrencies;
    if (next) {
      if (!isValidCurrency(next)) throw new ApiError(400, 'Unsupported currency');
      const code = normalizeCurrency(next);
      req.userDoc.preferredCurrency = code;
      req.userDoc.preferredCurrencies = [code];
    }
  }
  await req.userDoc.save();
  res.json({ ok: true, user: req.userDoc.toPublicJSON() });
});
