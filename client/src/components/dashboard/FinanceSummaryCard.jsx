import { Link } from 'react-router-dom';
import { useT } from '../../i18n/LanguageContext';

const PERIODS = [
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' }
];

const CHIPS = [
  { to: '/finance/revenue', label: 'Revenue' },
  { to: '/finance/expenses', label: 'Expenses' },
  { to: '/finance/cash-flow', label: 'Cash Flow' },
  { to: '/finance/profit-loss', label: 'Profit & Loss' }
];

/** API sends e.g. "12.5% margin" / "8% net margin" — translate via catalog keys. */
function translatePlSub(sub, t) {
  const raw = String(sub || '').trim();
  if (!raw) return '';
  const margin = raw.match(/^([\d.]+)%\s+margin$/i);
  if (margin) return t('{pct}% margin', { pct: margin[1] });
  const netMargin = raw.match(/^([\d.]+)%\s+net margin$/i);
  if (netMargin) return t('{pct}% net margin', { pct: netMargin[1] });
  return t(raw);
}

export default function FinanceSummaryCard({ finance, loading, period, onPeriodChange }) {
  const t = useT();
  if (loading) return <div className="dash-card accent-green skeleton" style={{ minHeight: 420 }} />;

  const fin = finance || {};
  const inPct = fin.cashFlow?.inXaf + fin.cashFlow?.outXaf
    ? Math.round((fin.cashFlow.inXaf / (fin.cashFlow.inXaf + fin.cashFlow.outXaf)) * 100)
    : 50;
  const periodLabel =
    period === 'year' ? t('This year') : period === 'quarter' ? t('This quarter') : t('This month');

  return (
    <div className="dash-card accent-green">
      <div className="dash-card-head dash-finance-head">
        <div className="dash-card-title">
          <i className="fas fa-wallet" /> {t('Finance Summary')}
        </div>
        <div className="dash-finance-toolbar">
          <div className="pill-select">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`pill-opt${period === p.value ? ' active' : ''}`}
                onClick={() => onPeriodChange(p.value)}
              >
                {t(p.label)}
              </button>
            ))}
          </div>
          <Link to="/finance" className="dash-link">{t('View All →')}</Link>
        </div>
      </div>
      <div className="dash-card-body">
        <div className="dash-fin-kpi-strip">
          <div className="dash-fin-kpi">
            <div className="dash-stat-label">{t('Revenue')}</div>
            <div className="dash-stat-value">{fin.revenue || '—'}</div>
            <div className="dash-stat-sub">
              {t('{count} entries · {period}', {
                count: fin.revenueTxnCount ?? 0,
                period: periodLabel
              })}
            </div>
          </div>
          <div className="dash-fin-kpi">
            <div className="dash-stat-label">{t('Expenses')}</div>
            <div className="dash-stat-value">{fin.expenses || '—'}</div>
            <div className="dash-stat-sub">
              {t('Top: {category}', { category: t(fin.topExpenseCategory || '—') })}
            </div>
          </div>
          <div className="dash-fin-kpi">
            <div className="dash-stat-label">{t('Net Profit')}</div>
            <div className={`dash-stat-value ${(fin.marginPct ?? 0) >= 0 ? 'dash-stat-green' : 'dash-stat-red'}`}>
              {fin.profit || '—'}
            </div>
            <div className="dash-stat-sub">{t('{pct}% margin', { pct: fin.marginPct ?? 0 })}</div>
          </div>
          <div className="dash-fin-kpi">
            <div className="dash-stat-label">{t('Cash Flow (Net)')}</div>
            <div className={`dash-stat-value ${(fin.cashFlow?.netXaf ?? 0) >= 0 ? 'dash-stat-green' : 'dash-stat-red'}`}>
              {fin.cashFlow?.netFmt || '—'}
            </div>
            <div className="dash-stat-sub">
              {t('In {in} · Out {out}', {
                in: fin.cashFlow?.inFmt || '—',
                out: fin.cashFlow?.outFmt || '—'
              })}
            </div>
          </div>
        </div>

        <div className="dash-fin-panels">
          <div className="dash-fin-panel">
            <div className="dash-panel-head">
              {t('Revenue')} <Link to="/finance/revenue">{t('Full revenue →')}</Link>
            </div>
            {(fin.revenueBySource || []).length ? fin.revenueBySource.map((s) => (
              <div key={s.source} className="dash-source-row">
                <span>{t(s.source)}</span>
                <div className="dash-cat-bar-track"><div className="dash-cat-bar-fill" style={{ width: `${s.pct}%`, background: 'var(--primary)' }} /></div>
                <span>{s.amount}</span>
              </div>
            )) : <p className="dash-empty">{t('No revenue in period')}</p>}
          </div>

          <div className="dash-fin-panel">
            <div className="dash-panel-head">
              {t('Expenses')} <Link to="/finance/expenses">{t('Full expenses →')}</Link>
            </div>
            <div className="dash-segment-bar">
              {(fin.expenseByCategory || []).map((c) => (
                <div key={c.category} style={{ width: `${c.pct}%`, background: c.color }} title={t(c.category)} />
              ))}
            </div>
            {(fin.expenseByCategory || []).map((c) => (
              <div key={c.category} className="dash-legend-row">
                <span><i style={{ background: c.color }} /> {t(c.category)}</span>
                <span>{c.pct}%</span>
              </div>
            ))}
          </div>

          <div className="dash-fin-panel">
            <div className="dash-panel-head">
              {t('Cash Flow')} <Link to="/finance/cash-flow">{t('Full ledger →')}</Link>
            </div>
            <div className="dash-cf-legend">
              <span>{t('In')} {fin.cashFlow?.inFmt}</span>
              <span>{t('Out')} {fin.cashFlow?.outFmt}</span>
              <span className={(fin.cashFlow?.netXaf ?? 0) >= 0 ? 'trend-up' : 'trend-down'}>
                {t('Net')} {fin.cashFlow?.netFmt}
              </span>
            </div>
            <div className="dash-cf-bar">
              <div style={{ width: `${inPct}%` }} className="cf-in" />
              <div style={{ width: `${100 - inPct}%` }} className="cf-out" />
            </div>
            {(fin.cashFlow?.transactions || []).length ? fin.cashFlow.transactions.map((txn) => (
              <div key={txn.id} className="dash-txn-row">
                <span>{new Date(txn.date).toISOString().slice(5, 10)} · {txn.description}</span>
                <span className={txn.type === 'revenue' ? 'trend-up' : 'trend-down'}>
                  {txn.type === 'revenue' ? '+' : '−'}{txn.amount}
                </span>
              </div>
            )) : <p className="dash-empty">{t('No transactions in period')}</p>}
          </div>

          <div className="dash-fin-panel">
            <div className="dash-panel-head">
              {t('Business P&L')} <Link to="/finance/profit-loss">{t('Full P&L →')}</Link>
            </div>
            {(fin.plSummary?.lines || []).length ? (fin.plSummary.lines).map((r) => (
              <div key={r.key} className={`dash-pl-row${r.bold ? ' dash-pl-row-bold' : ''}`}>
                <span>
                  {t(r.label)}
                  {r.sub ? (
                    <small className="dash-pl-sub"> · {translatePlSub(r.sub, t)}</small>
                  ) : null}
                </span>
                <span className={(r.amountXaf ?? 0) >= 0 && r.tone !== 'neg' ? 'trend-up' : 'trend-down'}>
                  {r.amountFmt}
                </span>
              </div>
            )) : <p className="dash-empty">{t('No P&L activity this period')}</p>}
          </div>
        </div>

        <div className="dash-module-chips">
          {CHIPS.map((c) => (
            <Link key={c.to} to={c.to} className="dash-chip">{t(c.label)}</Link>
          ))}
        </div>
        <Link to="/finance" className="dash-footer-link">{t('Open Finance →')}</Link>
      </div>
    </div>
  );
}
