import { useEffect, useState } from 'react';
import PillSelect from './PillSelect';
import CurrencySelect from '../common/CurrencySelect';
import { useT } from '../../i18n/LanguageContext';

export default function FinanceNavbar({
  onRecordExpense,
  showRecordExpense = true,
  showCurrency,
  showRange
}) {
  const t = useT();

  return (
    <div className="fin-nav-extras">
      {showRecordExpense && (
        <button
          type="button"
          className="btn-fin-expense"
          onClick={onRecordExpense}
          title={t('Expense')}
          aria-label={t('Expense')}
        >
          <i className="fas fa-minus-circle" />
          <span className="fin-chrome-label">{t('Expense')}</span>
        </button>
      )}
      {showCurrency && showCurrency}
      {showRange && showRange}
    </div>
  );
}

export function ExportButtons({ onExport }) {
  const t = useT();
  return (
    <>
      <button
        type="button"
        className="fin-export-btn excel"
        onClick={() => onExport?.('excel')}
        title={t('Export Excel')}
        aria-label={t('Export Excel')}
      >
        <i className="fas fa-file-excel" />
        <span className="fin-chrome-label">{t('Export Excel')}</span>
      </button>
      <button
        type="button"
        className="fin-export-btn pdf"
        onClick={() => onExport?.('pdf')}
        title={t('Export PDF')}
        aria-label={t('Export PDF')}
      >
        <i className="fas fa-file-pdf" />
        <span className="fin-chrome-label">{t('Export PDF')}</span>
      </button>
    </>
  );
}

export function RangePills({ value, onChange }) {
  const t = useT();
  return (
    <PillSelect
      name="range"
      value={value}
      onChange={onChange}
      options={[
        { value: 'week', label: t('This Week') },
        { value: 'month', label: t('This Month') },
        { value: 'quarter', label: t('This Quarter') },
        { value: 'ytd', label: t('YTD') }
      ]}
    />
  );
}

/** Full currency list as a dropdown (preferred currency for finance + app). */
export function CurrencyPills({ value, onChange }) {
  const t = useT();
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return (
    <div className="fin-currency-select-wrap">
      <label className="fin-currency-select-label" htmlFor="fin-currency">
        {t('Currency')}
      </label>
      <CurrencySelect
        id="fin-currency"
        className="fin-currency-select"
        value={value}
        onChange={onChange}
        compact={compact}
        ariaLabel={t('Preferred currency')}
      />
    </div>
  );
}
