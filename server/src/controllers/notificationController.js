import Notification from '../models/Notification.js';
import ApiError, { asyncHandler } from '../utils/ApiError.js';

export const list = asyncHandler(async (req, res) => {
  const filter = { user: req.userDoc._id };
  if (req.businessId) filter.business = req.businessId;
  if (req.query.read !== undefined) filter.read = req.query.read === 'true';
  const data = await Notification.find(filter).sort({ createdAt: -1 }).limit(50);
  const unread = await Notification.countDocuments({ ...filter, read: false });
  res.json({ ok: true, data, unread });
});

export const markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.userDoc._id },
    { read: true },
    { new: true }
  );
  if (!n) throw new ApiError(404, 'Notification not found');
  res.json({ ok: true, data: n });
});

export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.userDoc._id, read: false }, { read: true });
  res.json({ ok: true, message: 'All marked read' });
});

export const create = asyncHandler(async (req, res) => {
  const title = String(req.body.title || '').trim();
  if (!title) throw new ApiError(400, 'Notification title is required');
  const type = ['shipment', 'inventory', 'sale', 'purchase', 'system', 'alert'].includes(req.body.type)
    ? req.body.type
    : 'system';
  const doc = await Notification.create({
    title,
    message: String(req.body.message || '').slice(0, 2000),
    type,
    link: req.body.link || undefined,
    user: req.userDoc._id,
    business: req.businessId || null,
    read: false
  });
  res.status(201).json({ ok: true, data: doc });
});

export const remove = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, user: req.userDoc._id };
  if (req.businessId) filter.business = req.businessId;
  const doc = await Notification.findOneAndDelete(filter);
  if (!doc) throw new ApiError(404, 'Notification not found');
  res.json({ ok: true, message: 'Deleted' });
});
