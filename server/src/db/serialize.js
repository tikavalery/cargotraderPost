import { MODEL_FIELD_MAPS } from './fieldMaps.js';
import { isValidId } from '../utils/ids.js';

/**
 * Convert a Prisma row into a mongoose-like plain document for API responses.
 */
export function serializeDoc(row, modelName, { lean = true } = {}) {
  if (!row) return null;
  if (Array.isArray(row)) return row.map((r) => serializeDoc(r, modelName, { lean }));

  const map = MODEL_FIELD_MAPS[modelName] || { toPrisma: {}, fromPrisma: {} };
  const raw = { ...row };

  // Drop nested relation objects (keep FK ids via fromPrisma remap)
  const relationObjectKeys = [
    'owner',
    'business',
    'warehouse',
    'bale',
    'shipment',
    'purchase',
    'supplier',
    'posTransaction',
    'linkedItems',
    'bales',
    'staff',
    'logs',
    'damages',
    'stockFrom',
    'stockTo',
    'purchases',
    'salesReturns',
    'ownedBusinesses',
    'subscription',
    'notifications',
    'fromWarehouse',
    'toWarehouse',
    'items' // only when it's a relation array of Item, not JSON — handled below
  ];

  for (const key of relationObjectKeys) {
    if (key === 'items' && Array.isArray(raw.items) && raw.items.length && typeof raw.items[0] === 'object' && raw.items[0]?.sku !== undefined && !raw.items[0]?.id?.startsWith?.('c') === false) {
      // Bale.items / FinanceEntry.products-like JSON — keep
      // If it's Prisma Item[] relation, first element has prisma item shape with businessId
      if (raw.items[0]?.businessId !== undefined || raw.items[0]?.purchaseRefId !== undefined) {
        delete raw.items;
      }
      continue;
    }
    if (raw[key] != null && typeof raw[key] === 'object' && !Array.isArray(raw[key]) && !(raw[key] instanceof Date)) {
      delete raw[key];
    }
    if (Array.isArray(raw[key]) && raw[key][0]?.businessId !== undefined) {
      delete raw[key];
    }
  }

  const doc = {};
  for (const [key, value] of Object.entries(raw)) {
    const outKey = map.fromPrisma[key] || key;
    doc[outKey] = value;
  }

  const id = row.id != null ? String(row.id) : undefined;
  if (id) {
    doc._id = id;
    doc.id = id;
  }

  // Stringify FK-like fields for frontend compatibility
  for (const key of Object.keys(doc)) {
    if (doc[key] == null) continue;
    if (key === 'businesses' || key === 'members' || key === 'lines' || key === 'cart' || key === 'products' || key === 'statusHistory' || key === 'tracking' || key === 'mobileMoney' || key === 'meta' || key === 'photos' || key === 'receipts' || key === 'countriesOperated' || key === 'preferredCurrencies' || key === 'currencies' || key === 'inventoryGroups' || key === 'assignedWarehouses') {
      continue;
    }
    if (typeof doc[key] === 'object' && !(doc[key] instanceof Date) && !Array.isArray(doc[key])) {
      // leave nested plain objects (tracking, mobileMoney already skipped if named)
    }
  }

  if (lean) return doc;

  return wrapDocument(doc, modelName);
}

export function wrapDocument(plain, modelName) {
  const state = { ...plain, __modelName: modelName, isNew: false, $locals: {} };

  const api = {
    ...state,
    toObject() {
      const { __modelName, isNew, $locals, ...rest } = state;
      return { ...rest, _id: state._id || state.id, id: state.id || state._id };
    },
    toJSON() {
      return this.toObject();
    },
    markModified() {},
    isModified() {
      return true;
    }
  };

  Object.defineProperty(api, '_id', {
    get() {
      return state._id || state.id;
    },
    set(v) {
      state._id = v;
      state.id = v;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(api, 'id', {
    get() {
      return state.id || state._id;
    },
    set(v) {
      state.id = v;
      state._id = v;
    },
    enumerable: true,
    configurable: true
  });

  // Proxy so property sets update state (for doc.field = x; await doc.save())
  return new Proxy(api, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return state[prop];
    },
    set(target, prop, value) {
      if (prop === '_id' || prop === 'id') {
        state._id = value;
        state.id = value;
        return true;
      }
      state[prop] = value;
      target[prop] = value;
      return true;
    },
    has(target, prop) {
      return prop in state || prop in target;
    },
    ownKeys() {
      return Reflect.ownKeys(state);
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop === '_id' || prop === 'id') {
        return Object.getOwnPropertyDescriptor(target, prop);
      }
      if (prop in state) {
        return { configurable: true, enumerable: true, writable: true, value: state[prop] };
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    }
  });
}

export { isValidId };
export default serializeDoc;
