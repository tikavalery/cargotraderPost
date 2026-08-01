import { useRef } from 'react';
import PosProductThumb from './PosProductThumb';
import { useT } from '../../i18n/LanguageContext';
import { formatXaf } from '../../utils/format';

export default function ProductCard({ product, onPreview, onQuickAdd }) {
  const t = useT();
  const lastTap = useRef(0);

  const handleClick = () => {
    const now = Date.now();
    if (now - lastTap.current < 320) {
      onQuickAdd(product);
    } else {
      onPreview(product);
    }
    lastTap.current = now;
  };

  const stockLabel = product.outOfStock
    ? t('Out of stock')
    : product.lowStock || product.qty <= 3
      ? t('Only {n} left', { n: product.qty })
      : t('{n} in stock', { n: product.qty });

  return (
    <div
      className={`pos-product-card${product.outOfStock ? ' disabled' : ''}`}
      onClick={!product.outOfStock ? handleClick : undefined}
      role="button"
      tabIndex={product.outOfStock ? -1 : 0}
    >
      <div
        className="pos-product-img"
        style={{
          background: product.image
            ? 'var(--bg)'
            : `linear-gradient(135deg, ${product.color || '#E8ECF0'}22, var(--bg))`
        }}
      >
        <span className="pos-cat-badge">{t(product.catLabel || product.category || '')}</span>
        {(product.lowStock || product.qty <= 3) && !product.outOfStock && (
          <span className="pos-low-badge">{t('Low')}</span>
        )}
        <PosProductThumb
          image={product.image}
          icon={product.icon}
          color={product.color}
          iconClassName="pos-product-icon"
        />
        {!product.outOfStock && (
          <button
            type="button"
            className="pos-quick-add"
            onClick={(e) => {
              e.stopPropagation();
              onQuickAdd(product);
            }}
            aria-label={t('Quick add')}
          >
            <i className="fas fa-plus" />
          </button>
        )}
      </div>
      <div className="pos-product-info">
        <div className="pos-product-name">{product.name}</div>
        <div className="pos-product-sku">{product.sku}</div>
        <div className="pos-product-price">
          {formatXaf(product.price)}
        </div>
        <div className={product.lowStock || product.qty <= 3 ? 'pos-stock-low' : 'pos-stock-ok'}>
          {stockLabel}
        </div>
      </div>
    </div>
  );
}
