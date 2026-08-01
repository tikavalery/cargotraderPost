import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExpensesPage from './ExpensesPage';

vi.mock('../../services/financeApi', () => ({
  financeApi: {
    expensesOverview: vi.fn(),
    deleteExpense: vi.fn(),
    updateExpense: vi.fn()
  }
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() })
}));

vi.mock('../../i18n/LanguageContext', () => ({
  useT: () => (key) => key,
  useLanguage: () => ({ lang: 'en', setLang: vi.fn(), toggleLang: vi.fn() })
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'Test', businessName: 'Test Co', role: 'Business Owner' },
    isAuthenticated: true,
    loading: false
  })
}));

vi.mock('../../context/CurrencyContext', () => ({
  useCurrency: () => ({ currency: 'XAF', setCurrency: vi.fn() }),
  CurrencyProvider: ({ children }) => children
}));

vi.mock('../../layout/AppShell', () => ({
  default: ({ children }) => <div data-testid="shell">{children}</div>
}));

import { financeApi } from '../../services/financeApi';
import { FinanceFilterProvider } from '../../context/FinanceFilterContext';

function wrap(ui) {
  return render(
    <MemoryRouter>
      <FinanceFilterProvider>{ui}</FinanceFilterProvider>
    </MemoryRouter>
  );
}

describe('ExpensesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders KPIs and table even with invalid expense dates', async () => {
    financeApi.expensesOverview.mockResolvedValue({
      data: {
        data: {
          summary: {
            total: '1,000 XAF',
            purchasesXaf: 500,
            shippingXaf: 200,
            operatingXaf: 300,
            purchasesPct: 50,
            shippingPct: 20,
            operatingPct: 30
          },
          list: {
            data: [
              {
                id: '1',
                date: 'not-a-real-date',
                category: 'Goods / COGS',
                description: 'Inventory: Car',
                amountXaf: 500,
                relatedTo: 'ITM-1',
                status: 'Synced',
                auto: true,
                source: 'Inventory'
              },
              {
                id: '2',
                date: new Date('2026-07-01').toISOString(),
                category: 'Freight & Shipping',
                description: 'Freight',
                amountXaf: 200,
                relatedTo: 'SH-1',
                status: 'Synced',
                auto: true,
                source: 'Shipping'
              }
            ]
          }
        }
      }
    });

    wrap(<ExpensesPage />);

    await waitFor(() => {
      expect(screen.getByText('Recent Expenses')).toBeInTheDocument();
    });
    expect(screen.getByText('Inventory: Car')).toBeInTheDocument();
    expect(screen.getByText('Freight')).toBeInTheDocument();
  });
});
