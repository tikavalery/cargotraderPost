import { VALID_CURRENCIES } from '../theme/authConstants';

export function resolveUserCurrency(user) {
  if (!user) return null;
  const code =
    user.preferredCurrency ||
    user.currency ||
    user.preferredCurrencies?.[0] ||
    user.currencies?.[0];
  return VALID_CURRENCIES.includes(code) ? code : 'XAF';
}

export function readStoredCurrency() {
  try {
    const code = localStorage.getItem('afritrade_currency');
    return VALID_CURRENCIES.includes(code) ? code : null;
  } catch {
    return null;
  }
}
