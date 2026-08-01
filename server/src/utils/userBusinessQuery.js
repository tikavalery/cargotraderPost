import prisma from '../db/prisma.js';
import { serializeDoc, wrapDocument } from '../db/serialize.js';

/**
 * Users store business membership in JSONB `businesses[]`.
 * Mongo-style `'businesses.business'` filters are not valid Prisma args.
 */

export async function findUsersByBusinessMembership(businessId, { lean = true } = {}) {
  const biz = String(businessId);
  const rows = await prisma.$queryRaw`
    SELECT
      u.id, u.name, u.email, u.phone, u."googleId", u."authProvider", u.role,
      u."countriesOperated", u."preferredCurrencies", u."preferredCurrency",
      u.businesses, u."defaultBusinessId", u."twoFactorEnabled", u."isActive",
      u."lastLoginAt", u."gracePeriodEnd", u."createdAt", u."updatedAt"
    FROM users u
    WHERE EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(u.businesses, '[]'::jsonb)) AS m
      WHERE m->>'business' = ${biz}
    )
    ORDER BY u."createdAt" DESC
  `;
  return rows.map((row) => {
    const plain = serializeDoc(normalizeRawUser(row), 'User', { lean: true });
    delete plain.password;
    delete plain.refreshTokenHash;
    return lean ? plain : wrapDocument(plain, 'User');
  });
}

function normalizeRawUser(row) {
  // pg returns Date objects; JSON columns may already be parsed
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    googleId: row.googleId,
    authProvider: row.authProvider,
    password: row.password,
    role: row.role,
    countriesOperated: row.countriesOperated || [],
    preferredCurrencies: row.preferredCurrencies || [],
    preferredCurrency: row.preferredCurrency,
    businesses: row.businesses || [],
    defaultBusinessId: row.defaultBusinessId,
    refreshTokenHash: row.refreshTokenHash,
    passwordResetTokenHash: row.passwordResetTokenHash,
    passwordResetExpires: row.passwordResetExpires,
    twoFactorEnabled: row.twoFactorEnabled,
    isActive: row.isActive,
    lastLoginAt: row.lastLoginAt,
    gracePeriodEnd: row.gracePeriodEnd,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function updateGracePeriodForBusinessUsers(businessId, gracePeriodEnd) {
  const biz = String(businessId);
  await prisma.$executeRaw`
    UPDATE users u
    SET "gracePeriodEnd" = ${gracePeriodEnd},
        "updatedAt" = NOW()
    WHERE EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(u.businesses, '[]'::jsonb)) AS m
      WHERE m->>'business' = ${biz}
    )
  `;
}

export async function findBusinessesForUser(userId) {
  const uid = String(userId);
  const rows = await prisma.$queryRaw`
    SELECT * FROM businesses b
    WHERE b."ownerId" = ${uid}
       OR EXISTS (
         SELECT 1
         FROM jsonb_array_elements(COALESCE(b.members, '[]'::jsonb)) AS m
         WHERE m->>'user' = ${uid}
       )
    ORDER BY b."createdAt" DESC
  `;
  return rows.map((row) =>
    serializeDoc(
      {
        id: row.id,
        name: row.name,
        slug: row.slug,
        ownerId: row.ownerId,
        country: row.country,
        currencies: row.currencies || [],
        address: row.address,
        taxId: row.taxId,
        inventoryGroups: row.inventoryGroups || [],
        members: row.members || [],
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      },
      'Business',
      { lean: true }
    )
  );
}

export async function reassignUserStoreIds(businessId, fromStoreId, toStoreId) {
  const biz = String(businessId);
  const fromId = String(fromStoreId);
  const toId = toStoreId == null ? '' : String(toStoreId);
  const users = await findUsersByBusinessMembership(biz, { lean: true });
  for (const user of users) {
    const businesses = Array.isArray(user.businesses) ? [...user.businesses] : [];
    let changed = false;
    const next = businesses.map((m) => {
      if (String(m.business) === biz && String(m.assignedStoreId || '') === fromId) {
        changed = true;
        return { ...m, assignedStoreId: toId };
      }
      return m;
    });
    if (changed) {
      await prisma.user.update({
        where: { id: String(user._id || user.id) },
        data: { businesses: next }
      });
    }
  }
}

export { normalizeRawUser };
