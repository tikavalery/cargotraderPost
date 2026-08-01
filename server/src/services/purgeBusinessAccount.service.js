import User from '../models/User.js';
import Business from '../models/Business.js';
import Item from '../models/Item.js';
import Bale from '../models/Bale.js';
import { Purchase, Supplier } from '../models/Purchase.js';
import {
  Warehouse,
  StockMovement,
  WarehouseStaff,
  WarehouseLog,
  WarehouseDamage
} from '../models/Warehouse.js';
import Store, { StoreLog } from '../models/Store.js';
import Shipment from '../models/Shipment.js';
import ShipmentDocument from '../models/ShipmentDocument.js';
import TrackingEvent from '../models/TrackingEvent.js';
import PosTransaction from '../models/PosTransaction.js';
import PosCustomer from '../models/PosCustomer.js';
import HeldSale from '../models/HeldSale.js';
import RegisterSession from '../models/RegisterSession.js';
import PromoCode from '../models/PromoCode.js';
import Sale from '../models/Sale.js';
import SalesReturn from '../models/SalesReturn.js';
import FinanceEntry from '../models/FinanceEntry.js';
import Subscription from '../models/Subscription.js';
import StaffInvitation from '../models/StaffInvitation.js';
import Notification from '../models/Notification.js';
import { cancelSubscriptionImmediately } from './stripeService.js';
import { cloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';

/**
 * Permanently delete a business and all data scoped to it.
 * Caller must already have verified the requester is the business owner.
 */
export async function purgeBusinessAccount(businessId) {
  const id = String(businessId);
  const filter = { business: id };

  const subscription = await Subscription.findOne({ business: id }).lean();
  if (subscription?.stripeSubscriptionId) {
    try {
      await cancelSubscriptionImmediately(subscription.stripeSubscriptionId);
    } catch (err) {
      // Continue wipe even if Stripe is down / already canceled
      console.warn(
        `[purgeBusiness] Stripe cancel failed for ${subscription.stripeSubscriptionId}:`,
        err.message
      );
    }
  }

  // Best-effort Cloudinary cleanup (photos live under afritrade/{businessId}/…)
  if (isCloudinaryConfigured()) {
    try {
      await cloudinary.api.delete_resources_by_prefix(`afritrade/${id}`);
      try {
        await cloudinary.api.delete_folder(`afritrade/${id}`);
      } catch {
        /* folder may already be empty / missing */
      }
    } catch (err) {
      console.warn(`[purgeBusiness] Cloudinary cleanup failed for ${id}:`, err.message);
    }
  }

  await Promise.all([
    Item.deleteMany(filter),
    Bale.deleteMany(filter),
    Purchase.deleteMany(filter),
    Supplier.deleteMany(filter),
    Warehouse.deleteMany(filter),
    StockMovement.deleteMany(filter),
    WarehouseStaff.deleteMany(filter),
    WarehouseLog.deleteMany(filter),
    WarehouseDamage.deleteMany(filter),
    Store.deleteMany(filter),
    StoreLog.deleteMany(filter),
    Shipment.deleteMany(filter),
    ShipmentDocument.deleteMany(filter),
    TrackingEvent.deleteMany(filter),
    PosTransaction.deleteMany(filter),
    PosCustomer.deleteMany(filter),
    HeldSale.deleteMany(filter),
    RegisterSession.deleteMany(filter),
    PromoCode.deleteMany(filter),
    Sale.deleteMany(filter),
    SalesReturn.deleteMany(filter),
    FinanceEntry.deleteMany(filter),
    StaffInvitation.deleteMany(filter),
    Notification.deleteMany(filter),
    Subscription.deleteMany(filter)
  ]);

  // Remove membership from every user who belonged to this business
  const { findUsersByBusinessMembership } = await import('../utils/userBusinessQuery.js');
  const members = await findUsersByBusinessMembership(id, { lean: true });
  let usersRemoved = 0;
  for (const member of members) {
    const user = await User.findById(member._id || member.id);
    if (!user) continue;
    user.businesses = (user.businesses || []).filter((m) => String(m.business) !== id);
    if (user.defaultBusinessId && String(user.defaultBusinessId) === id) {
      user.defaultBusinessId = user.businesses[0]?.business || null;
    }
    user.refreshTokenHash = undefined;

    if (!user.businesses.length) {
      // No remaining businesses — permanently remove the user account
      await User.deleteOne({ _id: user._id });
      usersRemoved += 1;
      continue;
    }
    await user.save();
  }

  await Business.deleteOne({ _id: id });

  return { businessId: id, membersAffected: members.length, usersRemoved };
}
