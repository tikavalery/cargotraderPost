import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import FinanceLayout from '../../components/finance/FinanceLayout';
import KpiCard from '../../components/finance/KpiCard';
import { ExportButtons } from '../../components/finance/FinanceNavbar';
import { useFinanceFilters } from '../../context/FinanceFilterContext';
import { financeApi } from '../../services/financeApi';
import { useToast } from '../../context/ToastContext';
import { useT } from '../../i18n/LanguageContext';
import {
  exportFinanceDashboardExcel,
  exportFinanceDashboardPdf
} from '../../utils/financeDashboardExport';

export default function FinanceDashboardPage() {
  const t = useT();
  const { currency, period } = useFinanceFilters();
  const { showToast } = useToast();
  const dataRef = useRef(null);

  const handleExport = (fmt) => {
    const dashboardData = dataRef.current;
    if (!dashboardData) {
      showToast(t('Dashboard data not loaded yet'));
      return;
    }
    if (fmt === 'excel') {
      const ok = exportFinanceDashboardExcel(dashboardData, { period, currency });
      if (ok) showToast(t('Excel export downloaded'), 'success');
      else showToast(t('Could not export Excel'));
      return;
    }
    if (fmt === 'pdf') {
      const ok = exportFinanceDashboardPdf(dashboardData, { period, currency });
      if (!ok) showToast(t('Allow pop-ups to export PDF'));
      else showToast(t('Print dialog opened — save as PDF'), 'success');
    }
  };

  return (
    <FinanceLayout
      title={<><i className="fas fa-chart-pie" /> {t('Finance Dashboard')}</>}
      subtitle={t('Summary across revenue, expenses, cash flow, P&L & more')}
      headerRight={(
        <div className="fin-dashboard-actions">
          <ExportButtons onExport={handleExport} />
        </div>
      )}
    >
      {({ tick }) => (
        <DashboardBody
          currency={currency}
          period={period}
          tick={tick}
          onData={(next) => { dataRef.current = next; }}
        />
      )}
    </FinanceLayout>
  );
}

function DashboardBody({ currency, period, tick, onData }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    financeApi.dashboard({ currency, period })
      .then((res) => {
        if (cancelled) return;
        const next = res.data?.data || null;
        setData(next);
        onData?.(next);
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
        onData?.(null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // onData writes to a parent ref; omit from deps to avoid refetch loops
  }, [currency, period, tick]);

  if (loading) return <div className="fin-empty">Loading dashboard…</div>;
  if (!data) return <div className="fin-empty">Unable to load finance data</div>;

  const { kpis, revenueBySource = [], expenseByCategory = [], cashFlow, plSummary } = data;
  const inPct = cashFlow?.inXaf + cashFlow?.outXaf ? Math.round((cashFlow.inXaf / (cashFlow.inXaf + cashFlow.outXaf)) * 100) : 50;
  const plLines = plSummary?.lines || [];

  return (
    <>
      <div className="kpi-grid">
        <KpiCard
          label="Total Revenue"
          value={kpis.revenue}
          accent="green"
          footer={(
            <>
              <span>{kpis.revenueTxnCount} revenue entries · This month</span>
              <Link to="/finance/revenue" className="fin-kpi-link">Full Revenue →</Link>
            </>
          )}
        />
        <KpiCard
          label="Total Expenses"
          value={kpis.expenses}
          accent="red"
          footer={(
            <>
              <span>Top: {kpis.topExpenseCategory}</span>
              <Link to="/finance/expenses" className="fin-kpi-link">Full Expenses →</Link>
            </>
          )}
        />
        <KpiCard
          label="Net Profit"
          value={kpis.profit}
          accent="gold"
          footer={(
            <>
              <span className={kpis.marginPct >= 0 ? 'trend-up' : 'trend-down'}>{kpis.marginPct}% margin</span>
              <Link to="/finance/profit-loss" className="fin-kpi-link">Full P&amp;L →</Link>
            </>
          )}
        />
        <KpiCard
          label="Cash Flow (Net)"
          value={cashFlow?.netFmt || '—'}
          accent="navy"
          footer={(
            <>
              <span>In {cashFlow?.inFmt || '—'} · Out {cashFlow?.outFmt || '—'}</span>
              <Link to="/finance/cash-flow" className="fin-kpi-link">Full Ledger →</Link>
            </>
          )}
        />
      </div>

      <div className="finance-left">
        <div className="fin-card">
          <div className="fin-card-header">
            <div className="fin-card-title"><i className="fas fa-arrow-trend-up" /> Revenue Summary</div>
            <Link to="/finance/revenue" className="fin-link">Full Revenue →</Link>
          </div>
          <div className="fin-card-body">
            <div className="fin-total-green">{kpis.revenue}</div>
            {revenueBySource.map((s) => (
              <div key={s.source} className="source-bar-row">
                <div className="source-bar-label"><span>{s.source}</span><span>{s.amount} · {s.pct}%</span></div>
                <div className="source-bar-track"><div className="source-bar-fill" style={{ width: `${s.pct}%` }} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="fin-card">
          <div className="fin-card-header">
            <div className="fin-card-title"><i className="fas fa-receipt" /> Expense Summary</div>
            <Link to="/finance/expenses" className="fin-link">Full Expenses →</Link>
          </div>
          <div className="fin-card-body">
            <div className="fin-total-red">{kpis.expenses}</div>
            {expenseByCategory.length ? (
              [...expenseByCategory]
                .sort((a, b) => (b.amountXaf || 0) - (a.amountXaf || 0))
                .map((c) => (
                  <div key={c.category} className="source-bar-row">
                    <div className="source-bar-label">
                      <span>{c.category}</span>
                      <span>{c.amount} · {c.pct}%</span>
                    </div>
                    <div className="source-bar-track">
                      <div className="source-bar-fill expense" style={{ width: `${c.pct}%` }} />
                    </div>
                  </div>
                ))
            ) : (
              <div className="fin-empty" style={{ padding: '12px 0' }}>No expenses recorded this period</div>
            )}
          </div>
        </div>

        <div className="fin-card">
          <div className="fin-card-header">
            <div className="fin-card-title"><i className="fas fa-water" /> Cash Flow Snapshot</div>
            <Link to="/finance/cash-flow" className="fin-link">Full Ledger →</Link>
          </div>
          <div className="fin-card-body">
            <div className="cashflow-legend">
              <span>In {cashFlow?.inFmt || '—'}</span>
              <span>Out {cashFlow?.outFmt || '—'}</span>
              <span className={(cashFlow?.netXaf ?? 0) >= 0 ? 'trend-up' : 'trend-down'}>Net {cashFlow?.netFmt || '—'}</span>
            </div>
            <div className="cashflow-bar">
              <div className="cashflow-in" style={{ width: `${inPct}%` }} />
              <div className="cashflow-out" style={{ width: `${100 - inPct}%` }} />
            </div>
          </div>
        </div>

        <div className="fin-card">
          <div className="fin-card-header">
            <div className="fin-card-title"><i className="fas fa-coins" /> Business P&amp;L Summary</div>
            <Link to="/finance/profit-loss" className="fin-link">Full P&amp;L →</Link>
          </div>
          <div className="fin-card-body fin-table-wrap">
            <table className="fin-table">
              <thead><tr><th>Line</th><th>Amount</th></tr></thead>
              <tbody>
                {plLines.length ? plLines.map((r) => (
                  <tr key={r.key} className={r.bold ? 'fin-pl-row-bold' : undefined}>
                    <td>
                      <strong>{r.label}</strong>
                      {r.sub ? <div className="fin-pl-line-sub">{r.sub}</div> : null}
                    </td>
                    <td className={r.tone === 'pos' ? 'profit-pos' : r.tone === 'neg' ? 'profit-neg' : undefined}>
                      {r.amountFmt}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={2} className="fin-empty">No P&amp;L activity this period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
