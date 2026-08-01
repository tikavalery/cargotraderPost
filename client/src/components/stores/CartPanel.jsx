import { useState } from 'react';
import { formatXaf } from '../../utils/format';
import { posApi } from '../../services/posApi';
import PosProductThumb from './PosProductThumb';
import { useT } from '../../i18n/LanguageContext';

export default function CartPanel({
  lines,
  totals,
  discType,
  discVal,
  promoCode,
  onDiscTypeChange,
  onDiscValChange,
  onPromoApply,
  onPromoClear,
  onUpdateQty,
  onRemoveLine,
  onHold,
  onCancel
}) {
  const t = useT();
  const [promoInput, setPromoInput] = useState('');
  const [applying, setApplying] = useState(false);

  const applyPromo = async () => {
    if (!promoInput.trim()) return;
    setApplying(true);
    try {
      const res = await posApi.validatePromo(promoInput.trim());
      if (res.data?.valid) {
        onPromoApply(promoInput.trim().toUpperCase(), res.data.discountPct);
        setPromoInput('');
      } else {
        onPromoApply('', 0);
        alert(t('Invalid promo code'));
      }
    } catch {
      const code = promoInput.trim().toUpperCase();
      const pct = code === 'THRIFT10' ? 10 : code === 'WELCOME5' ? 5 : 0;
      if (pct) onPromoApply(code, pct);
      else alert(t('Invalid promo code'));
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="pos-card pos-cart-card">
      <div className="pos-card-header">
        <div className="pos-card-title">
          <i className="fas fa-shopping-cart" /> {t('Current Sale')}
        </div>
        <div className="pos-card-actions">
          <button type="button" className="pos-btn-outline" onClick={onHold}>
            {t('Hold')}
          </button>
          <button type="button" className="pos-btn-text-danger" onClick={onCancel}>
            {t('Cancel')}
          </button>
        </div>
      </div>
      <div className="pos-card-body">
        {lines.length === 0 ? (
          <div className="pos-cart-empty">
            <i className="fas fa-shopping-basket" />
            <p>{t('Cart is empty')}</p>
            <span>{t('Tap a product to add items')}</span>
          </div>
        ) : (
          <div className="pos-cart-lines">
            {lines.map((line) => (
              <div key={line.sku} className="pos-cart-line">
                <div className="pos-cart-line-main">
                  <div
                    className="pos-cart-thumb"
                    style={{ background: line.image ? 'var(--bg)' : `${line.color || '#E8ECF0'}33` }}
                  >
                    <PosProductThumb
                      image={line.image}
                      icon={line.icon}
                      color={line.color}
                      className="pos-cart-photo"
                      iconClassName="pos-cart-icon"
                    />
                  </div>
                  <div className="pos-cart-line-info">
                    <div className="pos-cart-line-name" title={line.name}>
                      {line.name}
                    </div>
                    <div className="pos-cart-line-meta">
                      {t(line.catLabel || line.category || '')}
                    </div>
                    <div className="pos-cart-line-price">{formatXaf(line.price)}</div>
                  </div>
                  <button
                    type="button"
                    className="pos-line-delete"
                    onClick={() => onRemoveLine(line.sku)}
                    aria-label={t('Remove')}
                  >
                    <i className="fas fa-trash" />
                  </button>
                </div>
                <div className="pos-cart-line-actions">
                  <div className="pos-qty-stepper">
                    <button
                      type="button"
                      className="pos-qty-btn"
                      onClick={() => onUpdateQty(line.sku, -1)}
                      aria-label={t('Decrease quantity')}
                    >
                      −
                    </button>
                    <span className="pos-qty-val">{line.qty}</span>
                    <button
                      type="button"
                      className="pos-qty-btn"
                      onClick={() => onUpdateQty(line.sku, 1)}
                      aria-label={t('Increase quantity')}
                    >
                      +
                    </button>
                  </div>
                  <div className="pos-line-total">{formatXaf(line.price * line.qty)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pos-discount-section">
          <div className="pos-disc-toggle">
            <button
              type="button"
              className={discType === 'pct' ? 'active' : ''}
              onClick={() => onDiscTypeChange('pct')}
            >
              %
            </button>
            <button
              type="button"
              className={discType === 'xaf' ? 'active' : ''}
              onClick={() => onDiscTypeChange('xaf')}
            >
              XAF
            </button>
          </div>
          <div className="pos-disc-row">
            <input
              type="number"
              className="pos-disc-input"
              value={discVal}
              min={0}
              step={discType === 'pct' ? 1 : 100}
              placeholder="0"
              onChange={(e) => onDiscValChange(Number(e.target.value) || 0)}
            />
            <span className="pos-disc-applied">
              {t('Applied: −{amount}', { amount: formatXaf(totals.discount) })}
            </span>
          </div>
          {Number(totals.discount) > 0 && (
            <div className="pos-discount-warning" role="status">
              <i className="fas fa-exclamation-triangle" />
              {t('Discount of {amount} is active on this sale', {
                amount: formatXaf(totals.discount)
              })}
            </div>
          )}
          <div className="pos-promo-row">
            <input
              type="text"
              className="pos-promo-input"
              placeholder={t('Promo code')}
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyPromo()}
            />
            <button
              type="button"
              className="pos-btn-scan pos-promo-apply"
              onClick={applyPromo}
              disabled={applying}
            >
              {t('Apply')}
            </button>
          </div>
          {promoCode && (
            <span className="pos-promo-chip">
              {promoCode}
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                onClick={onPromoClear}
                aria-label={t('Clear promo')}
              >
                ×
              </button>
            </span>
          )}
        </div>

        <div className="pos-summary">
          <div className="pos-summary-row">
            <span>{t('Subtotal')}</span>
            <span>{formatXaf(totals.subtotal)}</span>
          </div>
          <div className="pos-summary-row discount">
            <span>{t('Discount')}</span>
            <span>−{formatXaf(totals.discount)}</span>
          </div>
          <div className="pos-summary-row">
            <span>{t('Tax')}</span>
            <span>{formatXaf(totals.tax)}</span>
          </div>
          <div className="pos-grand-total">
            <div className="pos-grand-num">{formatXaf(totals.total)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
