import prisma from './prisma.js';
import { MODEL_FIELD_MAPS } from './fieldMaps.js';
import { serializeDoc, wrapDocument, isValidId } from './serialize.js';

const PRISMA_DELEGATES = {
  User: 'user',
  Business: 'business',
  Item: 'item',
  Warehouse: 'warehouse',
  StockMovement: 'stockMovement',
  WarehouseStaff: 'warehouseStaff',
  WarehouseLog: 'warehouseLog',
  WarehouseDamage: 'warehouseDamage',
  Bale: 'bale',
  Purchase: 'purchase',
  Supplier: 'supplier',
  Shipment: 'shipment',
  ShipmentDocument: 'shipmentDocument',
  TrackingEvent: 'trackingEvent',
  Store: 'store',
  StoreLog: 'storeLog',
  PosTransaction: 'posTransaction',
  HeldSale: 'heldSale',
  RegisterSession: 'registerSession',
  PosCustomer: 'posCustomer',
  PromoCode: 'promoCode',
  SalesReturn: 'salesReturn',
  Sale: 'sale',
  FinanceEntry: 'financeEntry',
  Subscription: 'subscription',
  StripeWebhookEvent: 'stripeWebhookEvent',
  StaffInvitation: 'staffInvitation',
  Notification: 'notification'
};

const POPULATE_MAP = {
  Purchase: { supplier: { model: 'Supplier', fk: 'supplier' } },
  Item: {
    shipment: { model: 'Shipment', fk: 'shipment' },
    warehouse: { model: 'Warehouse', fk: 'warehouse' },
    bale: { model: 'Bale', fk: 'bale' },
    purchase: { model: 'Purchase', fk: 'purchase' },
    createdBy: { model: 'User', fk: 'createdBy' }
  },
  StaffInvitation: {
    invitedBy: { model: 'User', fk: 'invitedBy' },
    acceptedUser: { model: 'User', fk: 'acceptedUser' },
    business: { model: 'Business', fk: 'business' }
  },
  Shipment: { warehouse: { model: 'Warehouse', fk: 'warehouse' } },
  SalesReturn: { posTransaction: { model: 'PosTransaction', fk: 'posTransaction' } },
  Sale: { warehouse: { model: 'Warehouse', fk: 'warehouse' }, cashier: { model: 'User', fk: 'cashier' } }
};

function parsePopulateArg(path, select) {
  if (path && typeof path === 'object' && !Array.isArray(path)) {
    return { path: path.path, select: path.select || select };
  }
  return { path, select };
}

async function populateOne(doc, modelName, path, select) {
  if (!doc || !path) return doc;
  const cfg = POPULATE_MAP[modelName]?.[path];
  if (!cfg) return doc;

  const rawId = doc[path] ?? doc[mapKey(modelName, path)];
  const id =
    rawId && typeof rawId === 'object' ? String(rawId._id || rawId.id || '') : rawId != null ? String(rawId) : '';
  if (!id) {
    doc[path] = null;
    return doc;
  }

  const related = await delegateFor(cfg.model).findFirst({ where: { id } });
  if (!related) {
    doc[path] = null;
    return doc;
  }

  let plain = serializeDoc(related, cfg.model, { lean: true });
  if (select && typeof select === 'string') {
    const keep = new Set(select.split(/\s+/).filter(Boolean).concat(['_id', 'id']));
    const trimmed = {};
    for (const key of keep) {
      if (key in plain) trimmed[key] = plain[key];
    }
    plain = trimmed;
  }
  doc[path] = plain;
  return doc;
}

async function applyPopulate(docs, modelName, populateSpecs = []) {
  if (!populateSpecs?.length) return docs;
  const list = Array.isArray(docs) ? docs : [docs];
  for (const doc of list) {
    if (!doc) continue;
    for (const spec of populateSpecs) {
      const { path, select } = parsePopulateArg(spec);
      if (!path) continue;
      await populateOne(doc, modelName, path, select);
    }
  }
  return docs;
}

function attachDocHelpers(doc, modelName, options = {}) {
  if (!doc) return doc;
  doc.save = createSave(modelName);
  doc.isNew = false;
  doc.populate = async function populate(path, select) {
    await populateOne(this, modelName, path, select);
    return this;
  };
  if (options.methods) {
    for (const [name, fn] of Object.entries(options.methods)) {
      Object.defineProperty(doc, name, {
        value: fn.bind(doc),
        enumerable: false,
        configurable: true,
        writable: true
      });
    }
  }
  return doc;
}

function isDuplicateKeyError(err) {
  return (
    err?.code === 11000 ||
    err?.code === 'P2002' ||
    /Unique constraint failed|duplicate key/i.test(err?.message || '')
  );
}

const RELATION_UPDATE_MAP = {
  Business: { ownerId: 'owner' },
  Item: {
    businessId: 'business',
    warehouseId: 'warehouse',
    baleId: 'bale',
    shipmentId: 'shipment',
    purchaseRefId: 'purchase'
  },
  Warehouse: { businessId: 'business' },
  StockMovement: {
    businessId: 'business',
    fromWarehouseId: 'fromWarehouse',
    toWarehouseId: 'toWarehouse'
  },
  WarehouseStaff: { businessId: 'business', warehouseId: 'warehouse' },
  WarehouseLog: { businessId: 'business', warehouseId: 'warehouse' },
  WarehouseDamage: { businessId: 'business', warehouseId: 'warehouse' },
  Bale: { businessId: 'business', warehouseId: 'warehouse', shipmentId: 'shipment' },
  Purchase: { businessId: 'business', supplierId: 'supplier' },
  Supplier: { businessId: 'business' },
  Shipment: { businessId: 'business', warehouseRefId: 'warehouse' },
  ShipmentDocument: { businessId: 'business' },
  TrackingEvent: { businessId: 'business' },
  Store: { businessId: 'business' },
  StoreLog: { businessId: 'business', storeIdRef: 'store' },
  PosTransaction: { businessId: 'business' },
  HeldSale: { businessId: 'business' },
  RegisterSession: { businessId: 'business' },
  PosCustomer: { businessId: 'business' },
  PromoCode: { businessId: 'business' },
  SalesReturn: { businessId: 'business', posTransactionId: 'posTransaction' },
  Sale: { businessId: 'business' },
  FinanceEntry: { businessId: 'business' },
  Subscription: { businessId: 'business' },
  StaffInvitation: { businessId: 'business' },
  Notification: { businessId: 'business' }
};

/** Prisma update() rejects scalar FKs when a relation is defined — use connect/disconnect. */
export function toPrismaRelationUpdateData(modelName, data = {}) {
  const map = RELATION_UPDATE_MAP[modelName] || {};
  const out = sanitizeDataDefaults(modelName, { ...data });
  for (const [fk, rel] of Object.entries(map)) {
    if (!(fk in out)) continue;
    const val = out[fk];
    delete out[fk];
    if (val == null || val === '') {
      out[rel] = { disconnect: true };
    } else {
      out[rel] = { connect: { id: String(val) } };
    }
  }
  return out;
}

function delegateFor(modelName) {
  const key = PRISMA_DELEGATES[modelName];
  if (!key || !prisma[key]) throw new Error(`Unknown model: ${modelName}`);
  return prisma[key];
}

const NON_NULLABLE_STRING_DEFAULTS = {
  Item: { storeId: '', itemId: '', location: '', sourcedFromPurchaseId: '', icon: 'fa-box', color: '#8A97A8', currency: 'XAF', status: 'Stored', grade: 'A', category: 'Clothes' },
  Shipment: { warehouseId: '', trackingNumber: '', statusBadge: 'badge-transit', currentCity: '', currentCountry: '' },
  Warehouse: { address: '', location: '', manager: '', phone: '' },
  Bale: { sku: '', location: '', weight: '', source: '' },
  Purchase: { notes: '', location: '', itemName: '', sku: '' }
};

function sanitizeDataDefaults(modelName, data = {}) {
  const defaults = NON_NULLABLE_STRING_DEFAULTS[modelName] || {};
  const out = { ...data };
  for (const [key, fallback] of Object.entries(defaults)) {
    if (key in out && out[key] == null) out[key] = fallback;
  }
  return out;
}

function mapKey(modelName, key) {
  const map = MODEL_FIELD_MAPS[modelName]?.toPrisma || {};
  return map[key] || key;
}

function stripRegexNoise(source = '') {
  return String(source)
    .replace(/^\^/, '')
    .replace(/\$$/, '')
    .replace(/\\/g, '');
}

/** Prisma StringFilter: `mode` is sibling of `contains`/`not`, never nested inside `not`. */
function stringContainsFilter(source, options) {
  const filter = { contains: stripRegexNoise(source) };
  if (options == null || String(options).includes('i') || options === true) {
    filter.mode = 'insensitive';
  }
  return filter;
}

function mapIncomingData(modelName, data = {}) {
  const map = MODEL_FIELD_MAPS[modelName]?.toPrisma || {};
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === '_id') {
      out.id = value != null ? String(value) : value;
      continue;
    }
    if (key === '__v' || key === '$locals' || key === 'isNew') continue;
    const mapped = map[key] || key;
    // Don't pass nested relation objects into Prisma create/update
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && value._id) {
      out[mapped] = String(value._id || value.id);
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && value.id && map[key]) {
      out[mapped] = String(value.id);
      continue;
    }
    out[mapped] = value;
  }
  return sanitizeDataDefaults(modelName, out);
}

function convertFilterValue(modelName, key, value) {
  if (value === null) {
    const defaults = NON_NULLABLE_STRING_DEFAULTS[modelName] || {};
    if (key in defaults) return defaults[key];
    return null;
  }
  if (value === undefined) return undefined;
  if (value instanceof Date) return value;

  if (typeof value === 'object' && !Array.isArray(value)) {
    const ops = {};
    if ('$in' in value) {
      ops.in = value.$in.filter((v) => v != null).map((v) => String(v));
    }
    if ('$nin' in value) {
      const cleaned = value.$nin.filter((v) => v != null).map((v) => (v != null ? String(v) : v));
      if (cleaned.length) ops.notIn = cleaned;
      // Mongo $nin:[null,...] also excludes nulls; for nullable FKs add not-null via AND at call sites if needed
    }
    if ('$ne' in value) {
      const ne = value.$ne;
      ops.not = ne === null ? null : typeof ne === 'object' ? convertFilterValue(modelName, key, ne) : ne;
    }
    if ('$gt' in value) ops.gt = value.$gt;
    if ('$gte' in value) ops.gte = value.$gte;
    if ('$lt' in value) ops.lt = value.$lt;
    if ('$lte' in value) ops.lte = value.$lte;
    if ('$exists' in value) {
      if (value.$exists) {
        ops.not = null;
      } else {
        const defaults = NON_NULLABLE_STRING_DEFAULTS[modelName] || {};
        if (key in defaults) return defaults[key];
        return null;
      }
    }
    if ('$regex' in value) {
      const source = value.$regex instanceof RegExp ? value.$regex.source : String(value.$regex);
      return stringContainsFilter(source, value.$options);
    }
    if ('$not' in value) {
      const inner = value.$not;
      if (inner instanceof RegExp) {
        // Prisma: `mode` belongs on the outer StringFilter, not inside `not`.
        return { not: { contains: stripRegexNoise(inner.source) }, mode: 'insensitive' };
      }
      const converted = convertFilterValue(modelName, key, inner);
      if (converted && typeof converted === 'object' && !Array.isArray(converted)) {
        const { mode, ...rest } = converted;
        if ('contains' in rest || 'startsWith' in rest || 'endsWith' in rest || 'equals' in rest) {
          return mode ? { not: rest, mode } : { not: rest };
        }
      }
      return { not: converted };
    }
    if (value instanceof RegExp) {
      return stringContainsFilter(value.source);
    }
    if (Object.keys(ops).length) return ops;
  }

  if (value instanceof RegExp) {
    return stringContainsFilter(value.source);
  }

  // ObjectId-like refs stored as strings
  if (typeof value === 'object' && value._id) return String(value._id);
  if (typeof value === 'object' && value.id && !Array.isArray(value)) return String(value.id);

  return value;
}

export function toPrismaWhere(modelName, filter = {}) {
  if (!filter || typeof filter !== 'object') return {};
  if (filter.AND || filter.OR || filter.NOT) {
    // already prisma-ish
    return filter;
  }

  const and = [];
  const orClauses = filter.$or;
  const andClauses = filter.$and;
  const rest = { ...filter };
  delete rest.$or;
  delete rest.$and;
  delete rest.$text;

  for (const [key, value] of Object.entries(rest)) {
    const prismaKey = mapKey(modelName, key);
    if (value === undefined) continue;
    and.push({ [prismaKey]: convertFilterValue(modelName, prismaKey, value) });
  }

  if (Array.isArray(andClauses)) {
    for (const clause of andClauses) {
      and.push(toPrismaWhere(modelName, clause));
    }
  }

  const where = {};
  if (and.length === 1 && !orClauses) return and[0];
  if (and.length) where.AND = and;
  if (Array.isArray(orClauses) && orClauses.length) {
    where.OR = orClauses.map((c) => toPrismaWhere(modelName, c));
  }
  return where;
}

function toPrismaOrderBy(modelName, sort = {}) {
  if (!sort || typeof sort !== 'object') return undefined;
  if (Array.isArray(sort)) return sort;
  const orderBy = [];
  for (const [key, dir] of Object.entries(sort)) {
    const prismaKey = mapKey(modelName, key);
    orderBy.push({ [prismaKey]: dir === -1 || dir === 'desc' || dir === 'DESC' ? 'desc' : 'asc' });
  }
  return orderBy.length ? orderBy : undefined;
}

function applyUpdateOps(modelName, update = {}) {
  if (!update || typeof update !== 'object') return { data: {} };

  if (update.$set || update.$inc || update.$unset || update.$push || update.$pull || update.$addToSet) {
    const data = mapIncomingData(modelName, update.$set || {});
    if (update.$inc) {
      for (const [key, amount] of Object.entries(update.$inc)) {
        const prismaKey = mapKey(modelName, key);
        data[prismaKey] = { increment: amount };
      }
    }
    if (update.$unset) {
      for (const key of Object.keys(update.$unset)) {
        const prismaKey = mapKey(modelName, key);
        data[prismaKey] = null;
      }
    }
    // $push / $pull for JSON/array fields — load-modify-save handled by callers usually;
    // best-effort for scalar string arrays via push
    if (update.$push) {
      for (const [key, val] of Object.entries(update.$push)) {
        const prismaKey = mapKey(modelName, key);
        const each = val?.$each || [val];
        data[prismaKey] = { push: each.length === 1 ? each[0] : each };
      }
    }
    return { data };
  }

  return { data: mapIncomingData(modelName, update) };
}

class Query {
  constructor(modelName, filter = {}, options = {}) {
    this.modelName = modelName;
    this.filter = filter || {};
    this._sort = options.sort || { createdAt: -1 };
    this._skip = options.skip || 0;
    this._limit = options.limit ?? undefined;
    this._select = null;
    this._lean = false;
    this._populate = [];
  }

  sort(sort) {
    this._sort = sort;
    return this;
  }

  skip(n) {
    this._skip = n || 0;
    return this;
  }

  limit(n) {
    this._limit = n;
    return this;
  }

  select(fields) {
    this._select = fields;
    return this;
  }

  lean() {
    this._lean = true;
    return this;
  }

  populate(path, select) {
    this._populate.push(select != null ? { path, select } : path);
    return this;
  }

  session() {
    return this;
  }

  async exec() {
    const delegate = delegateFor(this.modelName);
    const where = toPrismaWhere(this.modelName, this.filter);
    const orderBy = toPrismaOrderBy(this.modelName, this._sort);

    let select;
    if (this._select) {
      select = {};
      const parts = typeof this._select === 'string' ? this._select.split(/\s+/) : Object.keys(this._select);
      for (const part of parts) {
        if (!part) continue;
        const exclude = part.startsWith('-');
        const name = exclude ? part.slice(1) : part;
        const prismaKey = mapKey(this.modelName, name);
        if (exclude) {
          // Prisma select is inclusive-only; exclusions handled after fetch
          continue;
        }
        select[prismaKey] = true;
      }
      select.id = true;
      if (Object.keys(select).length <= 1) select = undefined;
    }

    const rows = await delegate.findMany({
      where,
      orderBy,
      skip: this._skip || undefined,
      take: this._limit,
      ...(select ? { select } : {})
    });

    let docs = rows.map((r) => serializeDoc(r, this.modelName, { lean: true }));
    if (!this._lean) {
      docs = docs.map((d) => attachDocHelpers(wrapDocument(d, this.modelName), this.modelName));
    }

    if (this._select && typeof this._select === 'string' && this._select.includes('-')) {
      const excludes = this._select.split(/\s+/).filter((p) => p.startsWith('-')).map((p) => p.slice(1));
      docs = docs.map((d) => {
        const copy = this._lean ? { ...d } : d;
        for (const ex of excludes) {
          delete copy[ex];
          delete copy[mapKey(this.modelName, ex)];
        }
        return copy;
      });
    }

    if (this._populate?.length) {
      await applyPopulate(docs, this.modelName, this._populate);
    }

    return docs;
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }
}

function createSave(modelName) {
  return async function save() {
    const delegate = delegateFor(modelName);
    const plain = this.toObject ? this.toObject() : { ...this };
    const id = plain._id || plain.id;
    // Drop methods / non-data props that may have been assigned onto the doc
    for (const key of Object.keys(plain)) {
      if (typeof plain[key] === 'function') delete plain[key];
    }
    delete plain.save;
    delete plain.populate;
    delete plain.matchPassword;
    delete plain.toPublicJSON;
    delete plain.toObject;
    delete plain.toJSON;
    delete plain.markModified;
    delete plain.isModified;
    delete plain.__modelName;
    delete plain.isNew;
    delete plain.$locals;
    delete plain.__prismaData;

    const data = mapIncomingData(modelName, plain);
    delete data.id;
    delete data._id;
    delete data.createdAt;
    delete data.updatedAt;
    for (const key of Object.keys(data)) {
      if (typeof data[key] === 'function') delete data[key];
    }

    // Model-specific hooks
    if (modelName === 'User' && data.password && !String(data.password).startsWith('$2')) {
      const bcrypt = (await import('bcryptjs')).default;
      data.password = await bcrypt.hash(data.password, 12);
    }
    if (modelName === 'FinanceEntry') {
      const { toXaf } = await import('../utils/financeHelpers.js');
      if (data.amount != null) {
        data.amountXaf = toXaf(data.amount, data.currency || 'XAF');
      }
      if (!data.entryId) {
        data.entryId = `fin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      }
    }
    if (modelName === 'Business' && !data.slug && data.name) {
      data.slug =
        data.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') +
        '-' +
        Date.now().toString(36);
    }

    let row;
    if (id && !this.isNew) {
      row = await delegate.update({
        where: { id: String(id) },
        data: toPrismaRelationUpdateData(modelName, data)
      });
    } else {
      if (modelName === 'Item') {
        const { enforceInventoryItemLimit } = await import('../utils/inventoryPlanEnforcement.js');
        if (!this.$locals?.skipPlanLimit) {
          await enforceInventoryItemLimit(data.businessId);
        }
      }
      row = await delegate.create({ data });
      this.isNew = false;
    }
    const serialized = serializeDoc(row, modelName, { lean: true });
    for (const [k, v] of Object.entries(serialized)) {
      if (k === '_id' || k === 'id') {
        this._id = v;
        this.id = v;
      } else if (typeof v !== 'function') {
        this[k] = v;
      }
    }
    return this;
  };
}

function withSessionSupport(run) {
  const chain = {
    session() {
      return this;
    },
    exec: run,
    then(resolve, reject) {
      return run().then(resolve, reject);
    },
    catch(reject) {
      return run().catch(reject);
    }
  };
  return chain;
}

export function createModel(modelName, options = {}) {
  const delegate = () => delegateFor(modelName);

  const Model = function ModelConstructor(data = {}) {
    const inputPlain = { ...data };
    if (data._id || data.id) {
      inputPlain._id = String(data._id || data.id);
      inputPlain.id = String(data._id || data.id);
    }
    const doc = attachDocHelpers(wrapDocument(inputPlain, modelName), modelName, options);
    doc.isNew = true;
    doc.$locals = data.$locals || {};
    return doc;
  };

  Model.modelName = modelName;
  Model.schema = { paths: {}, tree: {} };

  Model.find = (filter = {}, projection, opts) => {
    const q = new Query(modelName, filter);
    if (opts?.sort) q.sort(opts.sort);
    if (opts?.limit) q.limit(opts.limit);
    if (opts?.skip) q.skip(opts.skip);
    if (projection) q.select(projection);
    return q;
  };

  Model.findOne = (filter = {}) => {
    const state = { filter, lean: false, select: null, populate: [] };
    const run = async () => {
      const row = await delegateFor(modelName).findFirst({
        where: toPrismaWhere(modelName, state.filter)
      });
      if (!row) return null;
      const plain = serializeDoc(row, modelName, { lean: true });
      if (state.select && typeof state.select === 'string' && state.select.includes('-')) {
        const excludes = state.select
          .split(/\s+/)
          .filter((p) => p.startsWith('-'))
          .map((p) => p.slice(1));
        for (const ex of excludes) delete plain[ex];
      }
      if (state.lean) {
        if (state.populate.length) await applyPopulate(plain, modelName, state.populate);
        return plain;
      }
      const doc = attachDocHelpers(wrapDocument(plain, modelName), modelName, options);
      if (state.populate.length) await applyPopulate(doc, modelName, state.populate);
      return doc;
    };
    return {
      lean() {
        state.lean = true;
        return this;
      },
      select(fields) {
        state.select = fields;
        return this;
      },
      populate(path, select) {
        state.populate.push(select != null ? { path, select } : path);
        return this;
      },
      sort() {
        return this;
      },
      session() {
        return this;
      },
      exec: run,
      then(resolve, reject) {
        return run().then(resolve, reject);
      }
    };
  };

  Model.findById = (id) => Model.findOne({ _id: String(id) });

  Model.findByIdAndUpdate = async (id, update, opts = {}) => {
    return Model.findOneAndUpdate({ _id: String(id) }, update, opts);
  };

  Model.findOneAndUpdate = async (filter, update, opts = {}) => {
    const where = toPrismaWhere(modelName, filter);
    const { data } = applyUpdateOps(modelName, update);
    try {
      const existing = await delegateFor(modelName).findFirst({ where });
      if (!existing) {
        if (!opts.upsert) return null;
        const equality = {};
        for (const [key, value] of Object.entries(filter || {})) {
          if (key.startsWith('$')) continue;
          if (value !== null && typeof value === 'object' && !(value instanceof Date) && !value._id && !value.id) {
            continue;
          }
          equality[key] = value?._id || value?.id || value;
        }
        const createData = sanitizeDataDefaults(modelName, {
          ...mapIncomingData(modelName, equality),
          ...data
        });
        delete createData.id;
        delete createData._id;
        for (const key of Object.keys(createData)) {
          if (typeof createData[key] === 'function' || createData[key] === undefined) {
            delete createData[key];
          }
        }
        const row = await delegateFor(modelName).create({ data: createData });
        const plain = serializeDoc(row, modelName, { lean: true });
        if (opts.lean) return plain;
        return attachDocHelpers(wrapDocument(plain, modelName), modelName, options);
      }
      const row = await delegateFor(modelName).update({
        where: { id: existing.id },
        data: toPrismaRelationUpdateData(modelName, data)
      });
      const plain = serializeDoc(row, modelName, { lean: true });
      if (opts.lean) return plain;
      if (opts.new === false) {
        const oldPlain = serializeDoc(existing, modelName, { lean: true });
        return opts.lean ? oldPlain : attachDocHelpers(wrapDocument(oldPlain, modelName), modelName, options);
      }
      return attachDocHelpers(wrapDocument(plain, modelName), modelName, options);
    } catch (err) {
      throw err;
    }
  };

  Model.findOneAndDelete = async (filter) => {
    const where = toPrismaWhere(modelName, filter);
    const existing = await delegateFor(modelName).findFirst({ where });
    if (!existing) return null;
    await delegateFor(modelName).delete({ where: { id: existing.id } });
    return attachDocHelpers(
      wrapDocument(serializeDoc(existing, modelName, { lean: true }), modelName),
      modelName,
      options
    );
  };

  Model.findByIdAndDelete = (id) => Model.findOneAndDelete({ _id: String(id) });

  Model.create = async (data, _opts) => {
    // Mongoose-style Model.create([...docs], { session }) — session is a no-op on Postgres.
    if (Array.isArray(data)) {
      const docs = [];
      for (const item of data) docs.push(await Model.create(item));
      return docs;
    }
    const doc = new Model(data);
    await doc.save();
    return doc;
  };

  Model.insertMany = async (items = []) => {
    const docs = [];
    for (const item of items) {
      const created = await Model.create(item);
      docs.push(created);
    }
    return docs;
  };

  Model.countDocuments = (filter = {}) =>
    withSessionSupport(async () => delegateFor(modelName).count({ where: toPrismaWhere(modelName, filter) }));

  Model.deleteOne = (filter = {}) =>
    withSessionSupport(async () => {
      const existing = await delegateFor(modelName).findFirst({ where: toPrismaWhere(modelName, filter) });
      if (!existing) return { deletedCount: 0 };
      await delegateFor(modelName).delete({ where: { id: existing.id } });
      return { deletedCount: 1 };
    });

  Model.deleteMany = (filter = {}) =>
    withSessionSupport(async () => {
      const result = await delegateFor(modelName).deleteMany({ where: toPrismaWhere(modelName, filter) });
      return { deletedCount: result.count };
    });

  Model.updateOne = async (filter, update) => {
    const where = toPrismaWhere(modelName, filter);
    const existing = await delegateFor(modelName).findFirst({ where });
    if (!existing) return { matchedCount: 0, modifiedCount: 0 };

    // JSON / array operators that need read-modify-write
    if (update?.$pull || update?.$addToSet) {
      const data = { ...existing };
      if (update.$set) Object.assign(data, mapIncomingData(modelName, update.$set));
      if (update.$pull) {
        for (const [key, cond] of Object.entries(update.$pull)) {
          const prismaKey = mapKey(modelName, key);
          const arr = Array.isArray(data[prismaKey]) ? [...data[prismaKey]] : [];
          data[prismaKey] = arr.filter((item) => {
            if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
              return !Object.entries(cond).every(([ck, cv]) => String(item?.[ck]) === String(cv));
            }
            return String(item) !== String(cond);
          });
        }
      }
      if (update.$addToSet) {
        for (const [key, val] of Object.entries(update.$addToSet)) {
          const prismaKey = mapKey(modelName, key);
          const arr = Array.isArray(data[prismaKey]) ? [...data[prismaKey]] : [];
          const values = val?.$each || [val];
          for (const v of values) {
            if (!arr.some((x) => String(x) === String(v))) arr.push(v);
          }
          data[prismaKey] = arr;
        }
      }
      const mapped = mapIncomingData(modelName, serializeDoc(data, modelName, { lean: true }));
      delete mapped.id;
      delete mapped._id;
      delete mapped.createdAt;
      delete mapped.updatedAt;
      // Prefer only changed array fields + $set
      const patch = {};
      if (update.$set) Object.assign(patch, mapIncomingData(modelName, update.$set));
      if (update.$pull) {
        for (const key of Object.keys(update.$pull)) {
          const prismaKey = mapKey(modelName, key);
          patch[prismaKey] = data[prismaKey];
        }
      }
      if (update.$addToSet) {
        for (const key of Object.keys(update.$addToSet)) {
          const prismaKey = mapKey(modelName, key);
          patch[prismaKey] = data[prismaKey];
        }
      }
      await delegateFor(modelName).update({
        where: { id: existing.id },
        data: toPrismaRelationUpdateData(modelName, patch)
      });
      return { matchedCount: 1, modifiedCount: 1 };
    }

    const { data } = applyUpdateOps(modelName, update);
    await delegateFor(modelName).update({
      where: { id: existing.id },
      data: toPrismaRelationUpdateData(modelName, data)
    });
    return { matchedCount: 1, modifiedCount: 1 };
  };

  Model.updateMany = async (filter, update) => {
    const where = toPrismaWhere(modelName, filter);
    const rows = await delegateFor(modelName).findMany({ where, select: { id: true } });
    if (!rows.length) return { matchedCount: 0, modifiedCount: 0 };
    const { data } = applyUpdateOps(modelName, update);
    const patch = toPrismaRelationUpdateData(modelName, data);
    let modified = 0;
    for (const row of rows) {
      await delegateFor(modelName).update({ where: { id: row.id }, data: patch });
      modified += 1;
    }
    return { matchedCount: rows.length, modifiedCount: modified };
  };

  Model.exists = async (filter) => {
    const row = await delegateFor(modelName).findFirst({
      where: toPrismaWhere(modelName, filter),
      select: { id: true }
    });
    return row ? { _id: row.id } : null;
  };

  Model.estimatedDocumentCount = async () => delegateFor(modelName).count();

  Model.distinct = async (field, filter = {}) => {
    const prismaKey = mapKey(modelName, field);
    const where = toPrismaWhere(modelName, filter);
    const rows = await delegateFor(modelName).findMany({
      where,
      select: { [prismaKey]: true, id: true }
    });
    const seen = new Set();
    const values = [];
    for (const row of rows) {
      const val = row[prismaKey];
      if (val == null || val === '') continue;
      const key = Array.isArray(val) ? JSON.stringify(val) : String(val);
      if (seen.has(key)) continue;
      seen.add(key);
      values.push(val);
    }
    return values;
  };

  Model.bulkWrite = async (ops = [], _options = {}) => {
    let insertedCount = 0;
    let matchedCount = 0;
    let modifiedCount = 0;
    let upsertedCount = 0;
    for (const op of ops) {
      if (op.updateOne) {
        const { filter, update, upsert } = op.updateOne;
        const existing = await delegateFor(modelName).findFirst({
          where: toPrismaWhere(modelName, filter)
        });
        if (existing) {
          const { data } = applyUpdateOps(modelName, update);
          await delegateFor(modelName).update({
            where: { id: existing.id },
            data: toPrismaRelationUpdateData(modelName, data)
          });
          matchedCount += 1;
          modifiedCount += 1;
        } else if (upsert) {
          const setData = update?.$set || update || {};
          const createData = mapIncomingData(modelName, { ...filter, ...setData });
          delete createData.id;
          delete createData._id;
          await delegateFor(modelName).create({ data: sanitizeDataDefaults(modelName, createData) });
          upsertedCount += 1;
          insertedCount += 1;
        }
      } else if (op.insertOne) {
        const createData = mapIncomingData(modelName, op.insertOne.document || op.insertOne);
        delete createData.id;
        delete createData._id;
        await delegateFor(modelName).create({ data: sanitizeDataDefaults(modelName, createData) });
        insertedCount += 1;
      } else if (op.deleteOne) {
        await Model.deleteOne(op.deleteOne.filter || {});
      } else if (op.deleteMany) {
        await Model.deleteMany(op.deleteMany.filter || {});
      }
    }
    return { insertedCount, matchedCount, modifiedCount, upsertedCount, ok: 1 };
  };

  Model.aggregate = async () => {
    throw new Error(
      `aggregate() is not supported on PostgreSQL shim for ${modelName}. Use prisma groupBy / raw SQL helpers.`
    );
  };

  Model.syncIndexes = async () => {};
  Model.reconcileIndexes = async () => {};

  if (options.statics) {
    Object.assign(Model, options.statics);
  }

  return Model;
}

export { mapIncomingData, applyUpdateOps, delegateFor, PRISMA_DELEGATES };
export { isValidId };
export default createModel;
