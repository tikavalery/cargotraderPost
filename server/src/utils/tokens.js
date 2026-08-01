import jwt from 'jsonwebtoken';

export function signAccessToken(payload, rememberMe = false) {
  return jwt.sign({ ...payload, type: 'access' }, process.env.JWT_SECRET, {
    expiresIn: rememberMe ? '30d' : '24h'
  });
}

export function signRefreshToken(payload) {
  return jwt.sign({ ...payload, type: 'refresh' }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
}

export function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
  if (decoded.type !== 'refresh') throw new Error('Invalid refresh token');
  return decoded;
}

export function tokenExpiry(rememberMe = false) {
  const ms = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ms).toISOString();
}

export function normalizeIdentifier(value) {
  value = (value || '').trim();
  if (value.includes('@')) return value.toLowerCase();
  return value.replace(/\s+/g, '');
}

export function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/** Finance clients historically send pageSize; map to limit (max 100). */
export function parseFinancePagination(query = {}, { defaultLimit = 25 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const raw = query.limit ?? query.pageSize;
  const limit = Math.min(100, Math.max(1, parseInt(raw, 10) || defaultLimit));
  const skip = (page - 1) * limit;
  return { page, limit, pageSize: limit, skip };
}

export function buildSearchFilter(search, fields) {
  if (!search?.trim()) return {};
  const regex = new RegExp(search.trim(), 'i');
  return { $or: fields.map((f) => ({ [f]: regex })) };
}
