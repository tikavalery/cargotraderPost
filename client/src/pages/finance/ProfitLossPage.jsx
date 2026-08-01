import { useEffect, useMemo, useRef, useState } from 'react';
import FinanceLayout from '../../components/finance/FinanceLayout';
import ProfitLossKpiCard from '../../components/finance/ProfitLossKpiCard';
import ProfitLossStatement from '../../components/finance/ProfitLossStatement';
import { ExportButtons } from '../../components/finance/FinanceNavbar';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useT } from '../../i18n/LanguageContext';
import { financeApi } from '../../services/financeApi';
import { useCurrency } from '../../context/CurrencyContext';
import { emptyProfitLossData, normalizeProfitLossData } from '../../utils/normalizeProfitLoss';
import {
  copyProfitLossSummary,
  emailProfitLossToAccountant,
  exportProfitLossExcel,
  exportProfitLossPdf
} from '../../utils/profitLossExport';

function monthStart(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function toInputDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(iso) {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function quarterLabel() {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return `Q${q} ${now.getFullYear()}`;
}

function formatRangeLabel(range, customStart, customEnd) {
  const now = new Date();
  if (range === 'month') {
    const start = monthStart(now);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return `${formatDisplayDate(toInputDate(start))} – ${formatDisplayDate(toInputDate(end))}`;
  }
  if (range === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return `${formatDisplayDate(toInputDate(start))} – ${formatDisplayDate(toInputDate(end))}`;
  }
  if (range === 'quarter') {
    const q = Math.floor(now.getMonth() / 3);
    const start = new Date(now.getFullYear(), q * 3, 1);
    const end = new Date(now.getFullYear(), q * 3 + 3, 0);
    return `${formatDisplayDate(toInputDate(start))} – ${formatDisplayDate(toInputDate(end))}`;
  }
  if (range === 'ytd') {
    const start = new Date(now.getFullYear(), 0, 1);
    return `${formatDisplayDate(toInputDate(start))} – ${formatDisplayDate(toInputDate(now))}`;
  }
  if (range === 'custom') {
    return `${formatDisplayDate(customStart)} – ${formatDisplayDate(customEnd)}`;
  }
  return '';
}

function SendAccountantModal({ open, onClose, onExcel, onPdf, onCopy, onEmail }) {
  if (!open) return null;
  return (
    <div className="pos-modal-overlay open" onClick={onClose} role="presentation">
      <div className="pos-modal fin-expense-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="pl-share-title">
        <div className="pos-modal-header">
          <div>
            <div className="pos-modal-title" id="pl-share-title">Send to Accountant</div>
            <p className="fin-modal-sub">Share or export this Profit &amp; Loss statement</p>
          </div>
          <button type="button" className="pos-modal-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="pos-modal-body">
          <div className="pl-share-choices">
            <button type="button" className="pl-share-choice" onClick={onExcel}>
              <i className="fas fa-file-excel" />
              <strong>Export Excel</strong>
              <span>Download CSV for spreadsheets</span>
            </button>
            <button type="button" className="pl-share-choice" onClick={onPdf}>
              <i className="fas fa-file-pdf" />
              <strong>Export PDF</strong>
              <span>Print or save as PDF</span>
            </button>
            <button type="button" className="pl-share-choice" onClick={onCopy}>
              <i className="fas fa-copy" />
              <strong>Copy Summary</strong>
              <span>Copy text to clipboard</span>
            </button>
            <button type="button" className="pl-share-choice" onClick={onEmail}>
              <i className="fas fa-envelope" />
              <strong>Email Accountant</strong>
              <span>Open email with P&amp;L summary</span>
            </button>
          </div>
        </div>
        <div className="pos-modal-footer">
          <button type="button" className="pos-btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function ProfitLossPage() {
  const t = useT();
  const { user } = useAuth();
  const { currency } = useCurrency();
  const { showToast } = useToast();
  const businessName = user?.businessName || 'That Store';
  const now = new Date();
  const dataRef = useRef(emptyProfitLossData(currency));
  const metaRef = useRef({ rangeLabel: '', businessName });
  const [shareOpen, setShareOpen] = useState(false);

  const rangeOptions = useMemo(() => [
    { id: 'month', label: 'This Month' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'quarter', label: quarterLabel() },
    { id: 'ytd', label: 'YTD' },
    { id: 'custom', label: 'Custom' }
  ], []);

  const exportOpts = () => ({
    businessName: metaRef.current.businessName || businessName,
    rangeLabel: metaRef.current.rangeLabel || '',
    currency
  });

  const handleExport = (fmt) => {
    const data = dataRef.current;
    if (!data) {
      showToast('P&L data not loaded yet');
      return;
    }
    if (fmt === 'excel') {
      const ok = exportProfitLossExcel(data, {
        ...exportOpts(),
        filename: `profit-loss-${stampSafe()}.csv`
      });
      if (ok) showToast('Excel export downloaded', 'success');
      else showToast('Could not export Excel');
      return;
    }
    if (fmt === 'pdf') {
      const ok = exportProfitLossPdf(data, exportOpts());
      if (!ok) showToast('Allow pop-ups to export PDF');
      else showToast('Print dialog opened — save as PDF', 'success');
    }
  };

  const handleCopy = async () => {
    try {
      const ok = await copyProfitLossSummary(dataRef.current, exportOpts());
      if (ok) showToast('P&L summary copied to clipboard', 'success');
      else showToast('Could not copy to clipboard');
    } catch {
      showToast('Could not copy to clipboard');
    }
    setShareOpen(false);
  };

  const handleEmail = () => {
    emailProfitLossToAccountant(dataRef.current, exportOpts());
    showToast('Email draft opened', 'success');
    setShareOpen(false);
  };

  return (
    <>
      <FinanceLayout
        breadcrumbs={[
          { label: 'CargoTrader', to: '/dashboard' },
          { label: 'Finance', to: '/finance' },
          { label: 'Profit & Loss', current: true }
        ]}
        title={t('Profit & Loss Statement')}
        subtitle={`${businessName} · ${t('Financial Period')}`}
        hideGlobalFilters
        headerRight={(
          <div className="pl-header-actions">
            <ExportButtons onExport={handleExport} />
            <button
              type="button"
              className="pl-send-accountant"
              onClick={() => setShareOpen(true)}
              title={t('Send to Accountant')}
              aria-label={t('Send to Accountant')}
            >
              <i className="fas fa-paper-plane" />
              <span className="fin-chrome-label">{t('Send to Accountant')}</span>
            </button>
          </div>
        )}
      >
        {({ tick }) => (
          <PlBody
            tick={tick}
            rangeOptions={rangeOptions}
            businessName={businessName}
            periodDefault={now}
            dataRef={dataRef}
            metaRef={metaRef}
            onOpenShare={() => setShareOpen(true)}
          />
        )}
      </FinanceLayout>

      <SendAccountantModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onExcel={() => {
          handleExport('excel');
          setShareOpen(false);
        }}
        onPdf={() => {
          handleExport('pdf');
          setShareOpen(false);
        }}
        onCopy={handleCopy}
        onEmail={handleEmail}
      />
    </>
  );
}

function stampSafe() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function PlBody({ tick, rangeOptions, businessName, periodDefault, dataRef, metaRef, onOpenShare }) {
  const t = useT();
  const { currency } = useCurrency();
  const now = periodDefault || new Date();
  const [data, setData] = useState(() => emptyProfitLossData(currency));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [range, setRange] = useState('month');
  const [customStart, setCustomStart] = useState(toInputDate(monthStart(now)));
  const [customEnd, setCustomEnd] = useState(toInputDate(now));

  const queryParams = useMemo(() => {
    const params = { currency, range };
    if (range === 'custom') {
      params.start = customStart;
      params.end = customEnd;
    }
    return params;
  }, [currency, range, customStart, customEnd]);

  const rangeLabel = formatRangeLabel(range, customStart, customEnd);

  useEffect(() => {
    if (metaRef) metaRef.current = { businessName, rangeLabel };
  }, [businessName, rangeLabel, metaRef]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    financeApi.profitLoss(queryParams)
      .then((res) => {
        if (cancelled) return;
        const next = normalizeProfitLossData(res.data?.data, currency);
        setData(next);
        if (dataRef) dataRef.current = next;
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err.response?.data?.message || 'Could not load profit & loss data');
          const empty = emptyProfitLossData(currency);
          setData(empty);
          if (dataRef) dataRef.current = empty;
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [queryParams, tick, dataRef, currency]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        financeApi.profitLoss(queryParams)
          .then((res) => {
            const next = normalizeProfitLossData(res.data?.data, currency);
            setData(next);
            if (dataRef) dataRef.current = next;
          })
          .catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [queryParams, dataRef, currency]);

  const { kpis, statement } = data;

  return (
    <>
      <div className="pl-toolbar">
        <div className="pl-toolbar-left">
          <div className="pl-date-range">
            <i className="fas fa-calendar" />
            {rangeLabel}
          </div>
          <div className="pl-range-pills">
            {rangeOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`pl-range-pill${range === opt.id ? ' active' : ''}`}
                onClick={() => setRange(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="pl-send-accountant pl-send-accountant-secondary"
          onClick={onOpenShare}
          title={t('Send to Accountant')}
          aria-label={t('Send to Accountant')}
        >
          <i className="fas fa-paper-plane" />
          <span className="fin-chrome-label">{t('Send to Accountant')}</span>
        </button>
      </div>

      {range === 'custom' && (
        <div className="pl-custom-range pl-custom-range-bar">
          <label>
            <span>From</span>
            <input type="date" value={customStart} max={customEnd} onChange={(e) => setCustomStart(e.target.value)} />
          </label>
          <label>
            <span>To</span>
            <input
              type="date"
              value={customEnd}
              min={customStart}
              max={toInputDate(now)}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </label>
        </div>
      )}

      {loading && <div className="pl-banner loading"><i className="fas fa-spinner fa-spin" /> Loading statement…</div>}
      {loadError && !loading && <div className="pl-banner error" role="alert">{loadError}</div>}

      <div className="pl-kpi-row pl-kpi-row-statement">
        <ProfitLossKpiCard
          label="Total Revenue"
          amountXaf={kpis.revenue}
          currency={currency}
          tone="revenue"
        />
        <ProfitLossKpiCard
          label="Cost of Goods Sold"
          amountXaf={kpis.cogs}
          currency={currency}
          tone="goods"
        />
        <ProfitLossKpiCard
          label="Total Op. Expenses"
          amountXaf={kpis.operatingExpenses}
          currency={currency}
          tone="ship"
        />
        <ProfitLossKpiCard
          label="Net Profit"
          amountXaf={kpis.netProfit}
          currency={currency}
          tone="profit"
        />
        <ProfitLossKpiCard
          label="Gross Margin"
          amountXaf={0}
          currency={currency}
          tone="margin"
          customValue={`${kpis.grossMarginPct}%`}
        />
      </div>

      <ProfitLossStatement rows={statement} />
    </>
  );
}
