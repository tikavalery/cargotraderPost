import { PERMISSIONS } from '../constants/roles.js';

const COST_KEYS = ['purchasePrice', 'purchaseValue', 'valueXaf', 'unitCost', 'costUsd', 'landedCostUsd'];

export function canViewCost(role) {
  return (PERMISSIONS.viewCost || []).includes(role);
}

export function redactCostFields(record) {
  if (!record || typeof record !== 'object') return record;
  const out = record.toObject ? record.toObject() : { ...record };
  for (const key of COST_KEYS) {
    if (key in out) delete out[key];
  }
  return out;
}

export function redactCostList(records) {
  if (!Array.isArray(records)) return records;
  return records.map((r) => redactCostFields(r));
}

export function redactCostPayload(body, role) {
  if (canViewCost(role)) return body;
  if (!body || typeof body !== 'object') return body;
  const next = { ...body };
  if (Array.isArray(next.data)) next.data = redactCostList(next.data);
  else if (next.data && typeof next.data === 'object') next.data = redactCostFields(next.data);
  if (Array.isArray(next.items)) next.items = redactCostList(next.items);
  if (Array.isArray(next.purchases)) next.purchases = redactCostList(next.purchases);
  if (next.item) next.item = redactCostFields(next.item);
  return next;
}
