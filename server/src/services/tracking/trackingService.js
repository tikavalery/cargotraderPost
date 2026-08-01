import Shipment from '../../models/Shipment.js';
import TrackingEvent from '../../models/TrackingEvent.js';
import Notification from '../../models/Notification.js';
import Business from '../../models/Business.js';
import prisma from '../../db/prisma.js';
import { trackShipment } from './carrierFactory.js';
import { STATUS_BADGE, TRACKING_STAGES } from './carrierTypes.js';
import { shipmentByIdFilter } from '../../utils/shipmentHelpers.js';
import { applyEventLocation, formatLocationLabel } from './locationHelpers.js';

function isTraveler(shipment) {
  const tn = String(shipment.trackingNumber || shipment.container || '');
  return /traveler/i.test(tn) || /traveler/i.test(shipment.carrier || '') || shipment.shippingMethod === 'traveler';
}

async function findShipment(businessId, shipmentId) {
  return Shipment.findOne(shipmentByIdFilter(businessId, shipmentId));
}

async function listEvents(businessId, shipmentId) {
  return TrackingEvent.find({ business: businessId, shipmentId })
    .sort({ occurredAt: 1 })
    .lean();
}

async function notifyBusiness(shipment, status, description) {
  try {
    const business = await Business.findById(shipment.business).lean();
    if (!business) return;
    const userIds = new Set();
    if (business.owner) userIds.add(String(business.owner));
    (business.members || []).forEach((m) => {
      if (m.user) userIds.add(String(m.user));
    });
    const docs = [...userIds].map((userId) => ({
      user: userId,
      business: shipment.business,
      type: 'shipment',
      title: `${shipment.shipmentId} → ${status}`,
      message: description,
      link: `/shipping?shipment=${shipment.shipmentId}`,
      read: false,
      meta: {
        shipmentId: shipment.shipmentId,
        trackingNumber: shipment.trackingNumber,
        status
      }
    }));
    if (docs.length) await Notification.insertMany(docs);
  } catch (err) {
    console.warn('[tracking] notification failed:', err.message);
  }
}

/** Enable auto-tracking and run an initial poll when a tracking number is set. */
export async function registerShipmentTracking(businessId, shipment, { forceRefresh = true } = {}) {
  const trackingNumber = String(shipment.trackingNumber || shipment.container || '').trim();
  if (!trackingNumber || trackingNumber.length < 4 || isTraveler(shipment)) {
    return { ok: false, skipped: true };
  }

  shipment.trackingNumber = trackingNumber;
  if (!shipment.container) shipment.container = trackingNumber;
  shipment.tracking = {
    ...(shipment.tracking?.toObject?.() || shipment.tracking || {}),
    autoTrack: true,
    provider: process.env.TRACKING_PROVIDER || 'mock',
    lastError: '',
    mockStage: shipment.tracking?.mockStage ?? 0
  };
  await shipment.save();

  if (!forceRefresh) return { ok: true, registered: true };
  return refreshShipmentTracking(businessId, shipment.shipmentId, { advanceMock: true });
}

/** Fire-and-forget register used from create/update handlers. */
export function maybeRegisterTracking(businessId, shipment) {
  const tn = String(shipment?.trackingNumber || shipment?.container || '').trim();
  if (!tn || tn.length < 4) return;
  if (isTraveler(shipment)) return;
  registerShipmentTracking(businessId, shipment, { forceRefresh: true }).catch((err) => {
    console.warn('[tracking] register failed:', err.message);
  });
}

export async function getShipmentTracking(businessId, shipmentId) {
  const shipment = await findShipment(businessId, shipmentId);
  if (!shipment) return null;

  const events = await listEvents(businessId, shipment.shipmentId);
  return {
    ok: true,
    shipmentId: shipment.shipmentId,
    trackingNumber: shipment.trackingNumber || shipment.container || '',
    carrier: shipment.carrier,
    status: shipment.status,
    currentCity: shipment.currentCity || '',
    currentCountry: shipment.currentCountry || '',
    lastLocationUpdate: shipment.lastLocationUpdate || null,
    currentLocation: formatLocationLabel(shipment.currentCity, shipment.currentCountry),
    tracking: shipment.tracking || {},
    stages: TRACKING_STAGES.map((s) => s.status),
    events: events.map((e) => ({
      id: String(e._id),
      status: e.status,
      carrierStatus: e.carrierStatus,
      description: e.description,
      location: e.location,
      city: e.city || '',
      country: e.country || '',
      occurredAt: e.occurredAt,
      source: e.source
    })),
    statusHistory: (shipment.statusHistory || []).map((h) => ({
      status: h.status,
      note: h.note,
      at: h.at
    }))
  };
}

export async function refreshShipmentTracking(
  businessId,
  shipmentId,
  { advanceMock = false } = {}
) {
  const shipment = await findShipment(businessId, shipmentId);
  if (!shipment) {
    const err = new Error('Shipment not found');
    err.status = 404;
    throw err;
  }

  const trackingNumber = String(shipment.trackingNumber || shipment.container || '').trim();
  if (!trackingNumber) {
    const err = new Error('No tracking number on this shipment');
    err.status = 400;
    throw err;
  }

  let mockStage = Number(shipment.tracking?.mockStage ?? 0);
  if (
    advanceMock &&
    mockStage < TRACKING_STAGES.length - 1 &&
    shipment.status !== 'Delivered' &&
    shipment.mode !== 'completed'
  ) {
    mockStage += 1;
  }

  const result = await trackShipment({
    trackingNumber,
    carrier: shipment.carrier,
    origin: shipment.origin,
    dest: shipment.dest,
    mockStage
  });

  shipment.tracking = {
    ...(shipment.tracking?.toObject?.() || shipment.tracking || {}),
    autoTrack: shipment.tracking?.autoTrack !== false,
    provider: result.provider,
    carrierCode: result.carrierCode || shipment.tracking?.carrierCode || '',
    lastPolledAt: new Date(),
    mockStage,
    lastError: result.ok ? '' : result.error || 'Tracking failed'
  };

  if (!result.ok) {
    await shipment.save();
    return {
      ok: false,
      error: result.error,
      errorCode: result.errorCode,
      tracking: shipment.tracking,
      events: await listEvents(businessId, shipment.shipmentId)
    };
  }

  const previousStatus = shipment.status;
  let latestStatus = previousStatus;
  const newEvents = [];
  const businessIdStr = String(shipment.business?._id || shipment.business || businessId);

  // Load existing keys once so we never hit Prisma P2002 (which always logs).
  const existingRows = await TrackingEvent.find({
    business: businessIdStr,
    shipmentId: shipment.shipmentId
  })
    .select('carrierStatus description')
    .lean();
  const existingKeys = new Set(
    existingRows.map((row) => `${row.carrierStatus || ''}\0${row.description || ''}`)
  );

  const toCreate = [];
  for (const ev of result.events) {
    latestStatus = ev.status;
    const carrierStatus = ev.carrierStatus || '';
    const description = ev.description || '';
    const key = `${carrierStatus}\0${description}`;
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    toCreate.push({
      business: businessIdStr,
      shipmentId: shipment.shipmentId,
      trackingNumber,
      carrier: shipment.carrier,
      status: ev.status,
      carrierStatus,
      description,
      location: ev.location || formatLocationLabel(ev.city, ev.country),
      city: ev.city || '',
      country: ev.country || '',
      occurredAt: ev.occurredAt,
      source: result.provider,
      notified: false
    });
    shipment.tracking.lastEventAt = ev.occurredAt;
  }

  if (toCreate.length) {
    const resultCreate = await prisma.trackingEvent.createMany({
      data: toCreate.map((ev) => ({
        businessId: businessIdStr,
        shipmentId: ev.shipmentId,
        trackingNumber: ev.trackingNumber || '',
        carrier: ev.carrier || '',
        status: ev.status,
        carrierStatus: ev.carrierStatus || '',
        description: ev.description,
        location: ev.location || '',
        city: ev.city || '',
        country: ev.country || '',
        occurredAt: new Date(ev.occurredAt),
        source: ev.source || 'mock',
        notified: false
      })),
      skipDuplicates: true
    });
    if (resultCreate.count > 0) {
      const created = await TrackingEvent.find({
        business: businessIdStr,
        shipmentId: shipment.shipmentId,
        notified: false
      })
        .sort({ occurredAt: -1 })
        .limit(resultCreate.count);
      newEvents.push(...created);
    }
  }

  const latestFromCarrier = result.events[result.events.length - 1];
  if (latestFromCarrier) {
    applyEventLocation(shipment, latestFromCarrier);
  } else {
    const stored = await listEvents(businessId, shipment.shipmentId);
    if (stored.length) applyEventLocation(shipment, stored[stored.length - 1]);
  }

  if (latestStatus && latestStatus !== previousStatus) {
    shipment.status = latestStatus;
    shipment.statusBadge = STATUS_BADGE[latestStatus] || shipment.statusBadge;
    if (['Delivered', 'Closed', 'Offloaded'].includes(latestStatus)) {
      shipment.mode = 'completed';
    }
    shipment.statusHistory = shipment.statusHistory || [];
    shipment.statusHistory.push({
      status: latestStatus,
      note: `Auto-tracking (${result.provider})`,
      at: new Date()
    });
  }

  await shipment.save();

  if (newEvents.length && latestStatus !== previousStatus) {
    const last = newEvents[newEvents.length - 1];
    await notifyBusiness(shipment, latestStatus, last.description);
    await TrackingEvent.updateMany(
      { _id: { $in: newEvents.map((e) => e._id) } },
      { $set: { notified: true } }
    );
  }

  return {
    ok: true,
    status: shipment.status,
    tracking: shipment.tracking,
    currentCity: shipment.currentCity || '',
    currentCountry: shipment.currentCountry || '',
    lastLocationUpdate: shipment.lastLocationUpdate || null,
    currentLocation: formatLocationLabel(shipment.currentCity, shipment.currentCountry),
    newEvents: newEvents.length,
    events: await listEvents(businessId, shipment.shipmentId)
  };
}

/** Poll all active auto-tracked shipments (background job). */
export async function pollActiveShipments() {
  // `tracking` is JSONB in Postgres — nested autoTrack must be filtered in JS.
  const candidates = await Shipment.find({
    mode: 'active',
    status: { $nin: ['Delivered', 'Closed', 'Cancelled', 'Offloaded'] }
  }).limit(200);

  const active = candidates.filter((shipment) => {
    if (shipment.tracking?.autoTrack === false) return false;
    const tn = String(shipment.trackingNumber || '').trim();
    const container = String(shipment.container || '').trim();
    return Boolean(tn || container);
  }).slice(0, 100);

  let updated = 0;
  let errors = 0;

  for (const shipment of active) {
    if (isTraveler(shipment)) continue;
    try {
      const res = await refreshShipmentTracking(String(shipment.business), shipment.shipmentId, {
        advanceMock: true
      });
      if (res.ok && res.newEvents) updated += 1;
      if (!res.ok) errors += 1;
    } catch (err) {
      errors += 1;
      console.warn(`[tracking] poll failed for ${shipment.shipmentId}:`, err.message);
    }
  }

  return { polled: active.length, updated, errors };
}
