import { pollActiveShipments } from './trackingService.js';

let timer = null;
let running = false;

/**
 * Background poller for carrier tracking.
 * Default every 2 minutes in MVP (override with TRACKING_POLL_MS).
 */
export function startTrackingPoller() {
  if (timer) return;
  const ms = Number(process.env.TRACKING_POLL_MS) || 2 * 60 * 1000;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await pollActiveShipments();
      if (result.polled > 0) {
        console.log(
          `[tracking] poll: ${result.polled} shipments, ${result.updated} updated, ${result.errors} errors`
        );
      }
    } catch (err) {
      console.error('[tracking] poll failed:', err.message);
    } finally {
      running = false;
    }
  };

  // First run shortly after boot, then on interval
  setTimeout(tick, 15_000);
  timer = setInterval(tick, ms);
  console.log(`[tracking] poller started (every ${Math.round(ms / 1000)}s)`);
}

export function stopTrackingPoller() {
  if (timer) clearInterval(timer);
  timer = null;
}
