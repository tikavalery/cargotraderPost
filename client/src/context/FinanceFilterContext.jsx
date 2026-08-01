import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useCurrency } from './CurrencyContext';

const FinanceFilterContext = createContext(null);

export function FinanceFilterProvider({ children }) {
  const { currency, setCurrency } = useCurrency();
  const [period, setPeriod] = useState('month');
  const [range, setRange] = useState('month');

  const params = useMemo(() => ({ currency, period, range }), [currency, period, range]);

  const refreshKey = useCallback(() => Date.now(), []);

  return (
    <FinanceFilterContext.Provider value={{
      currency, setCurrency, period, setPeriod, range, setRange, params, refreshKey
    }}>
      {children}
    </FinanceFilterContext.Provider>
  );
}

export const useFinanceFilters = () => {
  const ctx = useContext(FinanceFilterContext);
  if (!ctx) {
    throw new Error('useFinanceFilters must be used within FinanceFilterProvider');
  }
  return ctx;
};
