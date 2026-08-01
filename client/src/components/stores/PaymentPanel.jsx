import { useEffect } from 'react';
import { formatXaf } from '../../utils/format';
import { groupDigits } from '../../utils/numberFormat';
import { calcChange } from '../../utils/calcCartTotals';
import { useT } from '../../i18n/LanguageContext';

const QUICK_AMOUNTS = [5000, 10000, 20000, 50000, 100000];

export default function PaymentPanel({
  payment,
  onPaymentChange,
  tendered,
  onTenderedChange,
  total,
  onComplete,
  completing
}) {
  const t = useT();

  // Cash is the only accepted method for now
  useEffect(() => {
    if (payment !== 'Cash') onPaymentChange?.('Cash');
  }, [payment, onPaymentChange]);

  const change = calcChange(tendered, total);
  const canComplete = total > 0 && !completing && tendered >= total;

  return (
    <div className="pos-card pos-right-col">
      <div className="pos-card-header">
        <div className="pos-card-title">
          <i className="fas fa-money-bill-wave" /> {t('Payment')}
        </div>
      </div>
      <div className="pos-card-body">
        <p className="pos-pay-note" role="status">
          {t('Only cash is accepted for now. Mobile Money and Card/POS are coming soon.')}
        </p>

        <div className="pos-pay-methods">
          <button
            type="button"
            className="pos-pay-btn active-cash"
            onClick={() => onPaymentChange('Cash')}
          >
            <i className="fas fa-money-bill-wave" /> {t('Cash')}
          </button>
          <button
            type="button"
            className="pos-pay-btn pos-pay-coming-soon"
            disabled
            title={t('Mobile Money payments coming soon')}
            aria-disabled="true"
          >
            <span className="pos-pay-btn-main">
              <i className="fas fa-mobile-alt" /> {t('Mobile Money')}
            </span>
            <span className="pos-pay-soon-badge">{t('Coming soon')}</span>
          </button>
          <button
            type="button"
            className="pos-pay-btn pos-pay-coming-soon"
            disabled
            title={t('Card / POS payments coming soon')}
            aria-disabled="true"
          >
            <span className="pos-pay-btn-main">
              <i className="fas fa-credit-card" /> {t('Card / POS')}
            </span>
            <span className="pos-pay-soon-badge">{t('Coming soon')}</span>
          </button>
        </div>

        <div className="pos-cash-section">
          <label htmlFor="tendered">{t('AMOUNT TENDERED')}</label>
          <input
            id="tendered"
            type="number"
            className="pos-tendered-input"
            value={tendered}
            onChange={(e) => onTenderedChange(Number(e.target.value) || 0)}
          />
          <div className="pos-change-box">
            <div className="pos-change-label">{t('CHANGE DUE')}</div>
            <div className="pos-change-val">{formatXaf(change)}</div>
          </div>
          <div className="pos-quick-amounts">
            {QUICK_AMOUNTS.map((amt) => (
              <button key={amt} type="button" className="pos-quick-amt" onClick={() => onTenderedChange(amt)}>
                {groupDigits(amt)}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="pos-complete-btn"
          disabled={!canComplete}
          onClick={onComplete}
        >
          <i className="fas fa-check" /> {t('COMPLETE SALE')}
        </button>

        <div className="pos-pay-footer">
          <button type="button" onClick={() => onTenderedChange(total)}>
            {t('Full Payment')}
          </button>
        </div>
      </div>
    </div>
  );
}
