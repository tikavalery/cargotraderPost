import { trackWithMock } from './mockCarrier.js';
import { trackWithShippo, shippoSupports } from './shippoCarrier.js';
import { trackWithEasyPost, easypostSupports } from './easypostCarrier.js';

/**
 * Resolve carrier provider from TRACKING_PROVIDER env.
 * Falls back to mock when live providers fail or are unconfigured.
 */
export async function trackShipment(req) {
  const preferred = String(process.env.TRACKING_PROVIDER || 'mock').toLowerCase();

  if (preferred === 'shippo' && shippoSupports()) {
    const result = await trackWithShippo(req);
    if (result.ok) return result;
    console.warn('[tracking] Shippo failed, falling back to mock:', result.error);
    return trackWithMock(req);
  }

  if (preferred === 'easypost' && easypostSupports()) {
    const result = await trackWithEasyPost(req);
    if (result.ok) return result;
    console.warn('[tracking] EasyPost failed, falling back to mock:', result.error);
    return trackWithMock(req);
  }

  return trackWithMock(req);
}
