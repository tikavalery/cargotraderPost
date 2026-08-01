import { toXaf } from '../constants/financeConstants';
import { formatMoney } from './format';

/**
 * Format an XAF-stored amount in the user's preferred display currency.
 * Name kept for older POS dual-currency callers.
 */
export function formatUsd(xaf) {
  return formatMoney(xaf);
}

/**
 * Format a value that is stored in USD (e.g. shipment landedCostUsd)
 * into the user's preferred display currency.
 */
export function formatUsdAmount(n) {
  return formatMoney(toXaf(Number(n) || 0, 'USD'));
}

export const XAF_PER_USD = 600;

