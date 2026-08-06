'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { SubscriptionProvider } from '../context/SubscriptionContext';
import { CurrencyProvider } from '../context/CurrencyContext';
import { ToastProvider } from '../context/ToastContext';
import { SearchProvider } from '../context/SearchContext';
import { WarehouseWorkerProvider } from '../context/WarehouseWorkerContext';
import { LanguageProvider } from '../i18n/LanguageContext';

export default function Providers({ children }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } }
      })
  );
  // BrowserRouter and existing SPA contexts expect `window` / `localStorage`.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LanguageProvider>
          <AuthProvider>
            <ToastProvider>
              <SubscriptionProvider>
                <CurrencyProvider>
                  <SearchProvider>
                    <WarehouseWorkerProvider>{children}</WarehouseWorkerProvider>
                  </SearchProvider>
                </CurrencyProvider>
              </SubscriptionProvider>
            </ToastProvider>
          </AuthProvider>
        </LanguageProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
