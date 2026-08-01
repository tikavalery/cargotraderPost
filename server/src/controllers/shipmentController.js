import Shipment from '../models/Shipment.js';
import ApiError, { asyncHandler } from '../utils/ApiError.js';
import { createResourceController } from './resourceController.js';

const base = createResourceController(Shipment, {
  idField: 'shipmentId',
  idPrefix: 'SHP',
  searchFields: ['shipmentId', 'trackingNumber', 'carrier', 'origin', 'dest'],
  extraFilter: (req) => {
    const f = {};
    if (req.query.mode) f.mode = req.query.mode;
    if (req.query.status) f.status = req.query.status;
    return f;
  },
  beforeCreate: (data, req) => {
    data.statusHistory = [{ status: data.status || 'In Transit', note: 'Created', by: req.userDoc._id }];
  }
});

export const list = base.list;
export const getOne = base.getOne;
export const create = base.create;
export const update = base.update;
export const remove = base.remove;

/** PATCH status with history — supports future carrier webhook integration */
export const updateStatus = asyncHandler(async (req, res) => {
  const { status, note, trackingNumber } = req.body;
  const shipment = await Shipment.findOne({ _id: req.params.id, business: req.businessId });
  if (!shipment) throw new ApiError(404, 'Shipment not found');

  if (status) {
    shipment.status = status;
    shipment.statusHistory.push({ status, note: note || '', by: req.userDoc._id });
    if (status === 'Delivered') shipment.mode = 'completed';
  }
  if (trackingNumber) shipment.trackingNumber = trackingNumber;
  await shipment.save();
  res.json({ ok: true, data: shipment });
});

export const complete = asyncHandler(async (req, res) => {
  const shipment = await Shipment.findOne({ _id: req.params.id, business: req.businessId });
  if (!shipment) throw new ApiError(404, 'Shipment not found');
  shipment.mode = 'completed';
  shipment.status = 'Delivered';
  shipment.statusHistory.push({ status: 'Delivered', note: 'Marked complete', by: req.userDoc._id });
  if (req.body.warehouse) shipment.warehouse = req.body.warehouse;
  if (req.body.warehouseName) shipment.warehouseName = req.body.warehouseName;
  await shipment.save();
  res.json({ ok: true, data: shipment });
});
