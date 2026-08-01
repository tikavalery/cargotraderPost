import Sale from '../models/Sale.js';
import Item from '../models/Item.js';
import ApiError, { asyncHandler } from '../utils/ApiError.js';
import { createResourceController } from './resourceController.js';
import { logItemActivity } from '../utils/inventoryActivityLog.js';

const base = createResourceController(Sale, {
  idField: 'saleId',
  idPrefix: 'SALE',
  searchFields: ['saleId', 'storeName', 'customerName'],
  extraFilter: (req) => {
    const f = {};
    if (req.query.source) f.source = req.query.source;
    return f;
  },
  beforeCreate: (data, req) => {
    data.cashier = req.userDoc._id;
    data.lines = data.lines || data.items || [];
    data.items = data.lines;
  },
  afterCreate: async (sale, req) => {
    const userName = req.userDoc?.name || req.user?.name || 'System';
    const saleRef = sale.saleId ? ` · ${sale.saleId}` : '';
    for (const line of sale.lines || []) {
      if (!line.sku && !line.productId) continue;
      let item = null;
      if (line.productId) {
        item = await Item.findOne({ _id: line.productId, business: req.businessId });
      }
      if (!item && line.sku) {
        const matches = await Item.find({ sku: line.sku, business: req.businessId, qty: { $gt: 0 } });
        item = matches.find((row) => row.status === 'In Store') || matches[0] || null;
      }
      if (item) {
        const qty = Math.max(0, Number(line.qty) || 1);
        item.qty = Math.max(0, item.qty - qty);
        if (item.qty === 0) item.status = 'Sold';
        await item.save();
        if (qty > 0) {
          await logItemActivity(item, {
            type: 'outbound',
            qty,
            desc: `Sold ${qty}× ${item.name || line.name || line.sku || 'Item'}${saleRef}`,
            source: 'Sale',
            userName
          });
        }
      }
    }
  }
});

export const list = base.list;
export const getOne = base.getOne;
export const create = base.create;
export const update = base.update;
export const remove = base.remove;

export const summary = asyncHandler(async (req, res) => {
  const sales = await Sale.find({ business: req.businessId, status: 'completed' });
  const total = sales.reduce((s, x) => s + x.total, 0);
  const bySource = {};
  sales.forEach((s) => {
    bySource[s.source] = (bySource[s.source] || 0) + s.total;
  });
  res.json({ ok: true, total, count: sales.length, bySource });
});
