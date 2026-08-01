import ApiError from './ApiError.js';
import { ROLES } from '../constants/roles.js';

/** Managers may manage other staff but not their own user record. */
export function assertCanModifyStaffTarget(req, targetUserId) {
  if (req.businessRole !== ROLES.MANAGER) return;
  if (String(targetUserId) === String(req.userDoc._id)) {
    throw new ApiError(403, 'Managers cannot modify their own staff record');
  }
}
