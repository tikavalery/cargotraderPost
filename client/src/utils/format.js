import { fmtCurrency } from '../constants/financeConstants';
import { readStoredCurrency } from './resolveCurrency';
import { groupDigits } from './numberFormat';

export { groupDigits } from './numberFormat';

/** US/UK-style digit grouping: 1,234,567 */
export function formatGroupedNumber(n, options = {}) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '—';
  return groupDigits(n, options);
}

/**
 * Format an amount stored in XAF into the user's preferred display currency.
 * Name kept for compatibility — values follow signup / finance / profile preference.
 */
export function formatXaf(n) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '—';
  const currency = readStoredCurrency() || 'XAF';
  return fmtCurrency(currency, Number(n) || 0);
}

/** Explicit currency formatter (XAF base amount). */
export function formatMoney(n, currency) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '—';
  return fmtCurrency(currency || readStoredCurrency() || 'XAF', Number(n) || 0);
}
