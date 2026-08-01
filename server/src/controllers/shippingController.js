import Shipment from '../models/Shipment.js';
import ShipmentDocument from '../models/ShipmentDocument.js';
import TrackingEvent from '../models/TrackingEvent.js';
import ApiError, { asyncHandler } from '../utils/ApiError.js';
import { parsePagination, buildSearchFilter } from '../utils/tokens.js';
import {
  buildStatsFromCounts,
  computeLandedCost,
  formatDocumentRow,
  formatShipmentRow,
  nextShipmentId,
  resolveShipmentId,
  shipmentByIdFilter,
  statusBadgeForStatus
} from '../utils/shipmentHelpers.js';
import { getShipmentItems, offloadShipmentItems } from '../utils/inventoryLocationHelpers.js';
import { invalidateFinanceSync } from '../services/financeSync.service.js';
import {
  getShipmentTracking,
  maybeRegisterTracking,
  refreshShipmentTracking
} from '../services/tracking/trackingService.js';
import { uploadDocumentBuffer, parseDataUrl, fetchRemoteFileBuffer, formatBytes } from '../services/cloudinaryUpload.service.js';
import { isCloudinaryConfigured } from '../config/cloudinary.js';

async function resolveDocumentFileUrl(businessId, fileUrl, fileName) {
  if (!fileUrl || typeof fileUrl !== 'string') return { fileUrl: '', fileName, fileSize: undefined };
  if (fileUrl.startsWith('https://') || fileUrl.startsWith('http://')) {
    return { fileUrl, fileName, fileSize: undefined };
  }
  if (!fileUrl.startsWith('data:')) return { fileUrl, fileName, fileSize: undefined };

  const parsed = parseDataUrl(fileUrl);
  if (!parsed || parsed.kind !== 'buffer') {
    throw new ApiError(400, 'Invalid document file data');
  }

  if (!isCloudinaryConfigured()) {
    throw new ApiError(
      503,
      'Cloudinary is not configured. Set CLOUDINARY_* env vars so documents can be stored and downloaded.'
    );
  }

  const uploaded = await uploadDocumentBuffer(parsed.buf, {
    mime: parsed.mime,
    fileName: fileName || 'document',
    folder: `afritrade/${businessId}/documents`
  });
  if (!uploaded?.url || uploaded.url.startsWith('data:')) {
    throw new ApiError(502, 'Document upload to Cloudinary failed');
  }
  return {
    fileUrl: uploaded.url,
    fileName: uploaded.fileName || fileName || 'document',
    fileSize: uploaded.fileSize || (uploaded.bytes != null ? formatBytes(uploaded.bytes) : undefined)
  };
}

async function findShipment(businessId, id) {
  const doc = await Shipment.findOne(shipmentByIdFilter(businessId, id));
  if (!doc) throw new ApiError(404, 'Shipment not found');
  return doc;
}

export const listShipments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { business: req.businessId };
  if (req.query.mode) filter.mode = req.query.mode;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.carrier) filter.carrier = new RegExp(req.query.carrier, 'i');
  Object.assign(filter, buildSearchFilter(req.query.search, ['shipmentId', 'trackingNumber', 'carrier', 'origin', 'dest']));

  const [docs, total] = await Promise.all([
    Shipment.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
    Shipment.countDocuments(filter)
  ]);

  res.json({
    ok: true,
    shipments: docs.map(formatShipmentRow),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
});

export const getShipment = asyncHandler(async (req, res) => {
  const doc = await findShipment(req.businessId, req.params.shipmentId);
  res.json({ ok: true, data: formatShipmentRow(doc) });
});

export const listShipmentItems = asyncHandler(async (req, res) => {
  const doc = await findShipment(req.businessId, req.params.shipmentId);
  let data = await getShipmentItems(req.businessId, doc);

  const category = String(req.query.category || '').trim();
  const search = String(req.query.search || '').trim().toLowerCase();
  if (category) data = data.filter((r) => r.category === category);
  if (search) {
    data = data.filter(
      (r) =>
        String(r.name || '').toLowerCase().includes(search) ||
        String(r.sku || '').toLowerCase().includes(search)
    );
  }

  const wantsPage = req.query.page != null || req.query.limit != null || req.query.pageSize != null;
  if (!wantsPage) {
    return res.json({ ok: true, data });
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || req.query.pageSize, 10) || 25));
  const total = data.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * limit;

  res.json({
    ok: true,
    data: data.slice(start, start + limit),
    pagination: {
      page: safePage,
      pageSize: limit,
      total,
      pages
    }
  });
});

export const createShipment = asyncHandler(async (req, res) => {
  let shipmentId = await resolveShipmentId(req.businessId, Shipment, req.body.shipmentId);
  const status = req.body.status || 'In Transit';
  const goodsUsd = Number(req.body.goodsCostUsd ?? req.body.goodsValue ?? 0);
  const freightUsd = Number(req.body.freightCostUsd ?? req.body.freight ?? 0);
  const landed = computeLandedCost({
    goods: goodsUsd,
    freight: freightUsd,
    insurancePct: Number(req.body.insurancePct) || 2,
    dutyPct: Number(req.body.dutyPct) || 18,
    vatPct: Number(req.body.vatPct) || 19.25,
    clearing: Number(req.body.clearingCost) || 350,
    items: Number(req.body.items) || 1
  });

  const payload = {
    business: req.businessId,
    shipmentId,
    origin: req.body.origin,
    originFlag: req.body.originFlag || '🇨🇳',
    originCountry: req.body.originCountry || '',
    dest: req.body.dest,
    destFlag: req.body.destFlag || '🇨🇲',
    destCountry: req.body.destCountry || '',
    carrier: req.body.carrier || 'TBD',
    shippingMethod: req.body.shippingMethod || 'ocean',
    container: req.body.container || req.body.trackingNumber || '',
    trackingNumber: req.body.trackingNumber || req.body.container || '',
    eta: req.body.eta || '',
    items: Number(req.body.items) || 0,
    weight: req.body.weight || '',
    goodsCost: req.body.goodsCost != null ? Number(req.body.goodsCost) : Math.round(goodsUsd * 600),
    shippingCost: req.body.shippingCost != null ? Number(req.body.shippingCost) : Math.round(freightUsd * 600),
    dutiesCost: req.body.dutiesCost != null ? Number(req.body.dutiesCost) : Math.round(landed.dutyAmt * 600),
    landedCostUsd: Math.round(req.body.landedCostUsd ?? landed.total),
    status,
    statusBadge: statusBadgeForStatus(status),
    mode: 'active',
    baleCount: Number(req.body.baleCount) || 0,
    individualCount: Number(req.body.individualCount) || 0,
    statusHistory: [{ status, note: 'Created', by: req.userDoc._id }],
    tracking: {
      autoTrack: true,
      provider: process.env.TRACKING_PROVIDER || 'mock',
      carrierCode: '',
      lastError: '',
      mockStage: 0
    }
  };

  const isDupKey = (err) => err?.code === 11000 || err?.errorResponse?.code === 11000;
  let doc;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (attempt > 0) {
      shipmentId = await nextShipmentId(req.businessId, Shipment);
      payload.shipmentId = shipmentId;
    }
    try {
      doc = await Shipment.create(payload);
      break;
    } catch (err) {
      if (!isDupKey(err)) throw err;
      if (attempt === 9) {
        throw new ApiError(409, 'Could not allocate a unique shipment ID. Please try again.');
      }
    }
  }

  invalidateFinanceSync(req.businessId);
  maybeRegisterTracking(req.businessId, doc);
  res.status(201).json({ ok: true, data: formatShipmentRow(doc) });
});

export const updateShipment = asyncHandler(async (req, res) => {
  const doc = await findShipment(req.businessId, req.params.shipmentId);
  const fields = [
    'origin', 'originFlag', 'originCountry', 'dest', 'destFlag', 'destCountry',
    'carrier', 'shippingMethod', 'container', 'trackingNumber', 'eta', 'items', 'weight',
    'goodsCost', 'shippingCost', 'dutiesCost', 'landedCostUsd', 'warehouseId', 'warehouseName',
    'baleCount', 'individualCount', 'mode'
  ];
  fields.forEach((f) => {
    if (req.body[f] != null) doc[f] = req.body[f];
  });

  if (req.body.originCountry) {
    doc.originCountry = req.body.originCountry;
    if (req.body.originFlag) doc.originFlag = req.body.originFlag;
  }
  if (req.body.destCountry) {
    doc.destCountry = req.body.destCountry;
    if (req.body.destFlag) doc.destFlag = req.body.destFlag;
  }
  if (req.body.container != null) {
    doc.container = req.body.container;
    doc.trackingNumber = req.body.trackingNumber ?? req.body.container;
  }

  const goodsUsd = req.body.goodsCostUsd ?? req.body.goodsValue;
  const freightUsd = req.body.freightCostUsd ?? req.body.freight;
  if (goodsUsd != null || freightUsd != null) {
    const calc = computeLandedCost({
      goods: Number(goodsUsd ?? doc.goodsCost / 600 ?? 0),
      freight: Number(freightUsd ?? doc.shippingCost / 600 ?? 0),
      insurancePct: Number(req.body.insurancePct) || doc.insurancePct || 2,
      dutyPct: Number(req.body.dutyPct) || doc.dutyPct || 18,
      vatPct: Number(req.body.vatPct) || doc.vatPct || 19.25,
      clearing: Number(req.body.clearingCost) || doc.clearingCost || 350,
      items: Number(req.body.items) || doc.items || 1
    });
    doc.landedCostUsd = Math.round(req.body.landedCostUsd ?? calc.total);
    doc.goodsCost = Math.round(calc.breakdown[0].value * 600);
    doc.shippingCost = Math.round(calc.breakdown[1].value * 600);
    doc.dutiesCost = Math.round(calc.dutyAmt * 600);
  }

  if (req.body.status) {
    const prevStatus = doc.status;
    doc.status = req.body.status;
    doc.statusBadge = statusBadgeForStatus(req.body.status);
    const completedStatuses = ['Delivered', 'Closed', 'Offloaded'];
    if (completedStatuses.includes(req.body.status)) {
      doc.mode = 'completed';
    } else if (req.body.mode === 'active' || !completedStatuses.includes(req.body.status)) {
      doc.mode = req.body.mode || 'active';
    }
    if (prevStatus !== req.body.status) {
      doc.statusHistory.push({
        status: req.body.status,
        note: req.body.statusNote || 'Updated',
        by: req.userDoc._id
      });
    }
  } else if (req.body.mode) {
    doc.mode = req.body.mode;
  }

  await doc.save();
  invalidateFinanceSync(req.businessId);
  maybeRegisterTracking(req.businessId, doc);
  res.json({ ok: true, data: formatShipmentRow(doc) });
});

export const deleteShipment = asyncHandler(async (req, res) => {
  const doc = await findShipment(req.businessId, req.params.shipmentId);
  await Promise.all([
    ShipmentDocument.deleteMany({ business: req.businessId, shipmentId: doc.shipmentId }),
    TrackingEvent.deleteMany({ business: req.businessId, shipmentId: doc.shipmentId }),
    Shipment.deleteOne({ _id: doc._id })
  ]);
  invalidateFinanceSync(req.businessId);
  res.json({ ok: true, message: 'Deleted' });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const doc = await findShipment(req.businessId, req.params.shipmentId);
  const { status, note } = req.body;
  if (status) {
    doc.status = status;
    doc.statusBadge = statusBadgeForStatus(status);
    doc.statusHistory.push({ status, note: note || '', by: req.userDoc._id });
    if (['Delivered', 'Closed', 'Offloaded'].includes(status)) doc.mode = 'completed';
  }
  await doc.save();
  invalidateFinanceSync(req.businessId);
  res.json({ ok: true, data: formatShipmentRow(doc) });
});

export const completeShipment = asyncHandler(async (req, res) => {
  const doc = await findShipment(req.businessId, req.params.shipmentId);
  doc.mode = 'completed';
  doc.status = req.body.status || 'Delivered';
  doc.statusBadge = statusBadgeForStatus(doc.status);
  if (req.body.warehouseId) doc.warehouseId = req.body.warehouseId;
  if (req.body.warehouseName) doc.warehouseName = req.body.warehouseName;
  doc.statusHistory.push({ status: doc.status, note: 'Completed / offloaded', by: req.userDoc._id });
  await doc.save();
  await offloadShipmentItems(req.businessId, doc);
  invalidateFinanceSync(req.businessId);
  res.json({ ok: true, data: formatShipmentRow(doc) });
});

export const patchCosts = asyncHandler(async (req, res) => {
  const doc = await findShipment(req.businessId, req.params.shipmentId);
  const calc = computeLandedCost({
    goods: Number(req.body.goodsValue ?? req.body.goods ?? 0),
    freight: Number(req.body.freight ?? 0),
    insurancePct: Number(req.body.insurancePct) || 2,
    dutyPct: Number(req.body.dutyPct) || 18,
    vatPct: Number(req.body.vatPct) || 19.25,
    clearing: Number(req.body.clearing) || 0,
    items: Number(req.body.items) || doc.items || 1
  });
  doc.landedCostUsd = Math.round(calc.total);
  doc.goodsCost = Math.round(calc.breakdown[0].value * 600);
  doc.shippingCost = Math.round(calc.breakdown[1].value * 600);
  doc.dutiesCost = Math.round(calc.dutyAmt * 600);
  doc.items = Number(req.body.items) || doc.items;
  await doc.save();
  invalidateFinanceSync(req.businessId);
  res.json({ ok: true, data: formatShipmentRow(doc), calc });
});

export const getStats = asyncHandler(async (req, res) => {
  const businessId = req.businessId;
  const [activeRows, completedRows] = await Promise.all([
    Shipment.find({ business: businessId, mode: 'active' }).lean(),
    Shipment.find({ business: businessId, mode: 'completed' }).lean()
  ]);

  const activeAgg = [
    {
      count: activeRows.length,
      inTransit: activeRows.filter((s) => s.status === 'In Transit').length,
      atCustoms: activeRows.filter((s) => s.status === 'At Customs').length,
      arrived: activeRows.filter((s) => s.status === 'Arrived').length,
      delayed: activeRows.filter((s) => s.status === 'Delayed').length,
      valueUsd: activeRows.reduce((s, r) => s + (r.landedCostUsd || 0), 0)
    }
  ];
  const completedAgg = [
    {
      count: completedRows.length,
      valueUsd: completedRows.reduce((s, r) => s + (r.landedCostUsd || 0), 0),
      itemsOffloaded: completedRows.reduce((s, r) => s + (r.items || 0), 0)
    }
  ];
  const routeKeys = new Set(activeRows.map((s) => `${s.origin}→${s.dest}`));
  const routeAgg = [{ routeCount: routeKeys.size }];

  const active = activeAgg[0] || {};
  const completed = completedAgg[0] || {};
  active.routeCount = routeAgg[0]?.routeCount || 0;

  res.json({ ok: true, ...buildStatsFromCounts(active, completed) });
});

export const listDocuments = asyncHandler(async (req, res) => {
  const filter = { business: req.businessId };
  if (req.query.shipmentId) filter.shipmentId = req.query.shipmentId;
  if (req.query.type && req.query.type !== 'all') filter.type = req.query.type;
  if (req.query.status && req.query.status !== 'all' && req.query.status !== 'All') {
    filter.status = req.query.status;
  }
  if (req.query.search) {
    const q = req.query.search.trim();
    filter.$or = [
      { name: new RegExp(q, 'i') },
      { fileName: new RegExp(q, 'i') },
      { shipmentId: new RegExp(q, 'i') },
      { route: new RegExp(q, 'i') }
    ];
  }

  const wantsPage = req.query.page != null || req.query.limit != null || req.query.pageSize != null;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || req.query.pageSize, 10) || 25));
  const skip = (page - 1) * limit;

  if (!wantsPage) {
    const docs = await ShipmentDocument.find(filter).sort({ createdAt: -1 });
    return res.json({ ok: true, documents: docs.map(formatDocumentRow), total: docs.length });
  }

  const [total, docs] = await Promise.all([
    ShipmentDocument.countDocuments(filter),
    ShipmentDocument.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
  ]);

  res.json({
    ok: true,
    documents: docs.map(formatDocumentRow),
    total,
    pagination: {
      page,
      pageSize: limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit))
    }
  });
});

export const createDocument = asyncHandler(async (req, res) => {
  const shipmentId = String(req.body.shipmentId || '').trim();
  if (!shipmentId) throw new ApiError(400, 'Select a shipment');

  const shipment = await Shipment.findOne(shipmentByIdFilter(req.businessId, shipmentId)).select(
    'shipmentId origin originFlag dest destFlag'
  );
  if (!shipment) throw new ApiError(404, 'Shipment not found');

  const incomingUrl = req.body.fileUrl || '';
  if (!incomingUrl) {
    throw new ApiError(400, 'Choose a file to upload (PDF, image, or office document)');
  }

  const docId = `doc-${Date.now()}`;
  let resolved;
  try {
    resolved = await resolveDocumentFileUrl(
      req.businessId,
      incomingUrl,
      req.body.fileName || `${docId}.pdf`
    );
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(502, err.message || 'Document file upload failed');
  }
  if (!resolved.fileUrl) {
    throw new ApiError(400, 'Document file upload failed — no file URL returned');
  }

  const route =
    req.body.route ||
    `${shipment.originFlag || ''} ${shipment.origin || ''} → ${shipment.destFlag || ''} ${shipment.dest || ''}`.trim();

  const doc = await ShipmentDocument.create({
    business: req.businessId,
    docId,
    shipmentId: shipment.shipmentId,
    name: (req.body.name || '').trim() || req.body.fileName || docId,
    type: req.body.type || 'invoice',
    fileName: resolved.fileName || req.body.fileName || `${docId}.pdf`,
    fileSize: resolved.fileSize || req.body.fileSize || '—',
    fileUrl: resolved.fileUrl,
    route,
    status: req.body.status || 'pending',
    notes: req.body.notes || ''
  });
  res.status(201).json({ ok: true, data: formatDocumentRow(doc) });
});

function contentDisposition(fileName, inline = false) {
  const safe = String(fileName || 'document').replace(/"/g, '');
  const type = inline ? 'inline' : 'attachment';
  return `${type}; filename="${safe}"`;
}

export const downloadDocument = asyncHandler(async (req, res) => {
  const doc = await ShipmentDocument.findOne({
    business: req.businessId,
    $or: [{ docId: req.params.docId }, { _id: req.params.docId }]
  });
  if (!doc) throw new ApiError(404, 'Document not found');
  if (!doc.fileUrl) throw new ApiError(404, 'This document has no file attached');

  const inline = String(req.query.inline || '') === '1';
  const fileName = doc.fileName || `${doc.docId || 'document'}.bin`;

  if (doc.fileUrl.startsWith('data:')) {
    const parsed = parseDataUrl(doc.fileUrl);
    if (!parsed || parsed.kind !== 'buffer') throw new ApiError(400, 'Corrupt stored file data');
    res.setHeader('Content-Type', parsed.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', contentDisposition(fileName, inline));
    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.send(parsed.buf);
  }

  if (!doc.fileUrl.startsWith('http://') && !doc.fileUrl.startsWith('https://')) {
    throw new ApiError(400, 'Unsupported file URL');
  }

  try {
    const remote = await fetchRemoteFileBuffer(doc.fileUrl);
    res.setHeader('Content-Type', remote.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', contentDisposition(fileName, inline));
    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.send(remote.buf);
  } catch (err) {
    console.error('[shipping/document/download]', err.message);
    throw new ApiError(502, err.message || 'Could not download document file');
  }
});

export const getDocument = asyncHandler(async (req, res) => {
  const doc = await ShipmentDocument.findOne({
    business: req.businessId,
    $or: [{ docId: req.params.docId }, { _id: req.params.docId }]
  });
  if (!doc) throw new ApiError(404, 'Document not found');
  res.json({ ok: true, data: formatDocumentRow(doc) });
});

export const updateDocument = asyncHandler(async (req, res) => {
  const doc = await ShipmentDocument.findOne({
    business: req.businessId,
    $or: [{ docId: req.params.docId }, { _id: req.params.docId }]
  });
  if (!doc) throw new ApiError(404, 'Document not found');

  const fields = ['shipmentId', 'name', 'type', 'fileName', 'fileSize', 'fileUrl', 'route', 'status', 'notes'];
  fields.forEach((f) => {
    if (req.body[f] != null) doc[f] = req.body[f];
  });
  if (req.body.fileUrl != null) {
    const resolved = await resolveDocumentFileUrl(req.businessId, doc.fileUrl, doc.fileName);
    doc.fileUrl = resolved.fileUrl;
    if (resolved.fileName) doc.fileName = resolved.fileName;
    if (resolved.fileSize) doc.fileSize = resolved.fileSize;
  }
  await doc.save();
  res.json({ ok: true, data: formatDocumentRow(doc) });
});

export const deleteDocument = asyncHandler(async (req, res) => {
  const doc = await ShipmentDocument.findOneAndDelete({
    business: req.businessId,
    $or: [{ docId: req.params.docId }, { _id: req.params.docId }]
  });
  if (!doc) throw new ApiError(404, 'Document not found');
  res.json({ ok: true, message: 'Deleted' });
});

export const nextId = asyncHandler(async (req, res) => {
  const id = await nextShipmentId(req.businessId, Shipment);
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0'
  });
  res.status(200).json({ ok: true, shipmentId: id });
});

/** Live carrier tracking timeline + history. */
export const getTracking = asyncHandler(async (req, res) => {
  const doc = await findShipment(req.businessId, req.params.shipmentId);
  const data = await getShipmentTracking(req.businessId, doc.shipmentId);
  res.json({ ok: true, ...data, shipment: formatShipmentRow(doc) });
});

/** Force a carrier poll (mock advances one stage for MVP demos). */
export const refreshTracking = asyncHandler(async (req, res) => {
  const doc = await findShipment(req.businessId, req.params.shipmentId);
  const tn = String(doc.trackingNumber || doc.container || '').trim();
  if (!tn) throw new ApiError(400, 'Add a tracking number before refreshing carrier status');
  const data = await refreshShipmentTracking(req.businessId, doc.shipmentId, {
    advanceMock: req.body?.advanceMock !== false
  });
  const fresh = await findShipment(req.businessId, doc.shipmentId);
  res.json({ ok: true, ...data, shipment: formatShipmentRow(fresh) });
});
