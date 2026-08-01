import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { userApi } from '../api';
import { VALID_CURRENCIES } from '../theme/authConstants';
import { readStoredCurrency, resolveUserCurrency } from '../utils/resolveCurrency';
import { useAuth } from './AuthContext';

const CurrencyContext = createContext(null);

function normalizeCode(code) {
  return VALID_CURRENCIES.includes(code) ? code : 'XAF';
}

export function CurrencyProvider({ children }) {
  const { user } = useAuth();
  const [currency, setCurrencyState] = useState(() => readStoredCurrency() || 'XAF');

  useEffect(() => {
    if (!user) {
      setCurrencyState(readStoredCurrency() || 'XAF');
      return;
    }
    const next = resolveUserCurrency(user);
    if (next) {
      setCurrencyState(next);
      localStorage.setItem('afritrade_currency', next);
    }
  }, [user?.id, user?.preferredCurrency, user?.currency]);

  const setCurrency = useCallback(
    (code) => {
      const next = normalizeCode(code);
      setCurrencyState(next);
      localStorage.setItem('afritrade_currency', next);

      if (user) {
        userApi.updateProfile({ preferredCurrency: next }).catch(() => {});
        const stored = { ...user, preferredCurrency: next, currency: next, preferredCurrencies: [next] };
        localStorage.setItem('afritrade_user', JSON.stringify(stored));
      }
    },
    [user]
  );

  const value = useMemo(() => ({ currency, setCurrency }), [currency, setCurrency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export const useCurrency = () => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return ctx;
};
