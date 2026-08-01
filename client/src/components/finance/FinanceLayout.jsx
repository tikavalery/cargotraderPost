import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import AppShell from '../../layout/AppShell';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFinanceFilters } from '../../context/FinanceFilterContext';
import { useT } from '../../i18n/LanguageContext';
import FinanceNavbar, { CurrencyPills } from './FinanceNavbar';
import { RecordRevenueModal, RecordExpenseModal } from './RecordModals';

const PERIOD_LABELS = { month: 'Month', quarter: 'Quarter', year: 'Year' };

export default function FinanceLayout({ children, breadcrumbs, title, subtitle, headerRight, hideGlobalFilters, showSearch, searchPlaceholder }) {
  return (
    <FinanceLayoutInner breadcrumbs={breadcrumbs} title={title} subtitle={subtitle} headerRight={headerRight} hideGlobalFilters={hideGlobalFilters} showSearch={showSearch} searchPlaceholder={searchPlaceholder}>
      {children}
    </FinanceLayoutInner>
  );
}

function FinanceLayoutInner({ children, breadcrumbs, title, subtitle, headerRight, hideGlobalFilters, showSearch, searchPlaceholder }) {
  const t = useT();
  const location = useLocation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { currency, setCurrency, period, setPeriod } = useFinanceFilters();
  const isFinanceDashboard = location.pathname === '/finance' || location.pathname === '/finance/';
  const isRevenuePage = location.pathname.startsWith('/finance/revenue');
  const isExpensesPage = location.pathname.startsWith('/finance/expenses');
  const isCashFlowPage = location.pathname.startsWith('/finance/cash-flow');
  const isProfitLossPage = location.pathname.startsWith('/finance/profit-loss');
  const isListPage = isRevenuePage || isExpensesPage || isCashFlowPage || isProfitLossPage;
  const pageClass = [
    'content',
    'fin-page',
    isFinanceDashboard ? 'fin-dashboard-page' : '',
    isListPage ? 'fin-list-page' : '',
    isRevenuePage ? 'fin-revenue-page' : '',
    isExpensesPage ? 'fin-expenses-page' : '',
    isCashFlowPage ? 'fin-cash-flow-page' : '',
    isProfitLossPage ? 'fin-profit-loss-page' : ''
  ]
    .filter(Boolean)
    .join(' ');
  const shellClass = [
    'app-shell--finance',
    isFinanceDashboard ? 'app-shell--finance-dashboard' : '',
    isListPage ? 'app-shell--finance-list' : '',
    isRevenuePage ? 'app-shell--finance-revenue' : '',
    isExpensesPage ? 'app-shell--finance-expenses' : '',
    isCashFlowPage ? 'app-shell--finance-cash-flow' : '',
    isProfitLossPage ? 'app-shell--finance-profit-loss' : ''
  ]
    .filter(Boolean)
    .join(' ');
  const [revOpen, setRevOpen] = useState(false);
  const [expOpen, setExpOpen] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [savingRevenue, setSavingRevenue] = useState(false);
  const [tick, setTick] = useState(0);
  const businessName = user?.businessName || 'ThriftShip Cameroon';

  const refresh = () => setTick((n) => n + 1);
  const openRecordExpense = () => setExpOpen(true);
  const openRecordRevenue = () => setRevOpen(true);
  const layoutActions = { refresh, openRecordExpense, openRecordRevenue };

  const handleRevenue = async (data) => {
    setSavingRevenue(true);
    try {
      const { financeApi } = await import('../../services/financeApi');
      await financeApi.createRevenue(data);
      showToast(t('Revenue recorded'), 'success');
      setRevOpen(false);
      refresh();
    } catch (e) {
      showToast(e.response?.data?.message || t('Failed to record revenue'));
    } finally {
      setSavingRevenue(false);
    }
  };

  const handleExpense = async (data) => {
    setSavingExpense(true);
    try {
      const { financeApi } = await import('../../services/financeApi');
      await financeApi.createExpense(data);
      showToast(t('Expense recorded'), 'success');
      setExpOpen(false);
      refresh();
    } catch (e) {
      showToast(e.response?.data?.message || t('Failed to record expense'));
    } finally {
      setSavingExpense(false);
    }
  };

  const resolvedHeaderRight = typeof headerRight === 'function' ? headerRight(layoutActions) : headerRight;
  const titleNode = typeof title === 'string' ? t(title) : title;
  const subtitleNode = typeof subtitle === 'string' ? t(subtitle) : subtitle;

  return (
    <>
      <AppShell
        className={shellClass}
        hideSearch={!showSearch}
        searchPlaceholder={searchPlaceholder || t('Search revenue records, stores…')}
        breadcrumbs={breadcrumbs || [{ label: 'CargoTrader', to: '/dashboard' }, { label: 'Finance', current: true }]}
        navbarRight={
          <FinanceNavbar
            onRecordExpense={openRecordExpense}
            showRecordExpense={!isFinanceDashboard && !isRevenuePage}
          />
        }
      >
        <div className={pageClass}>
          {(title || subtitle) && (
            <div className="fin-page-header">
              <div className="fin-page-header-text">
                {title && <h1>{titleNode}</h1>}
                {subtitle && <p className="fin-page-sub">{businessName} · {subtitleNode}</p>}
              </div>
              <div className="fin-page-header-controls">
                {!hideGlobalFilters && (
                  <>
                    <CurrencyPills value={currency} onChange={setCurrency} />
                    <div className="pill-select">
                      {['month', 'quarter', 'year'].map((p) => (
                        <button key={p} type="button" className={`pill-opt${period === p ? ' active' : ''}`} onClick={() => setPeriod(p)}>
                          {t(PERIOD_LABELS[p])}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {resolvedHeaderRight}
              </div>
            </div>
          )}
          {typeof children === 'function' ? children({ refresh, tick, ...layoutActions }) : children}
        </div>
      </AppShell>
      <RecordRevenueModal open={revOpen} onClose={() => setRevOpen(false)} onSubmit={handleRevenue} saving={savingRevenue} />
      <RecordExpenseModal open={expOpen} onClose={() => setExpOpen(false)} onSubmit={handleExpense} saving={savingExpense} />
    </>
  );
}
