import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { ToastProvider } from './context/ToastContext';
import { SearchProvider } from './context/SearchContext';
import { WarehouseWorkerProvider } from './context/WarehouseWorkerContext';
import { LanguageProvider } from './i18n/LanguageContext';
import App from './App';
import './styles/auth.css';
import './styles/inventory.css';
import './styles/item-detail.css';
import './styles/purchases.css';
import './styles/warehouses.css';
import './styles/shipping.css';
import './styles/stores.css';
import './styles/finance.css';
import './styles/dashboard.css';
import './styles/navbar-user.css';
import './styles/pricing.css';
import './styles/billing.css';
import './styles/tables.css';
import './styles/responsive-tables.css';
import './styles/pagination.css';
/* After tables.css so Users & Staff / settings overrides win */
import './styles/settings.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LanguageProvider>
          <AuthProvider>
            <ToastProvider>
              <SubscriptionProvider>
                <CurrencyProvider>
                  <SearchProvider>
                    <WarehouseWorkerProvider>
                      <App />
                    </WarehouseWorkerProvider>
                  </SearchProvider>
                </CurrencyProvider>
              </SubscriptionProvider>
            </ToastProvider>
          </AuthProvider>
        </LanguageProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
