import { formatXaf } from '../../utils/format';
import PosProductThumb from './PosProductThumb';
import { useT } from '../../i18n/LanguageContext';

export default function ProductDetailModal({ product, open, onClose, onAdd }) {
  const t = useT();
  if (!product) return null;

  return (
    <div className={`pos-modal-overlay${open ? ' open' : ''}`} onClick={onClose} role="presentation">
      <div className="pos-modal pos-modal-lg" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="pos-modal-header">
          <div className="pos-modal-title">{product.name}</div>
          <button type="button" className="pos-modal-close" onClick={onClose} aria-label={t('Close')}>
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="pos-modal-body">
          <div
            className="pos-detail-img"
            style={{
              background: product.image
                ? 'var(--bg)'
                : `linear-gradient(135deg, ${product.color || '#E8ECF0'}33, var(--bg))`
            }}
          >
            <span className="pos-cat-badge">{t(product.catLabel || product.category || '')}</span>
            <PosProductThumb
              image={product.image}
              icon={product.icon}
              color={product.color}
              iconClassName="pos-detail-icon"
            />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>
            {formatXaf(product.price)}
          </div>
          <dl className="pos-detail-meta">
            <div>
              <dt>{t('Category')}</dt>
              <dd>{t(product.category || '')}</dd>
            </div>
            <div>
              <dt>{t('In Stock')}</dt>
              <dd>{product.qty}</dd>
            </div>
            <div>
              <dt>{t('SKU')}</dt>
              <dd>{product.sku}</dd>
            </div>
          </dl>
        </div>
        <div className="pos-modal-footer">
          <button type="button" className="pos-btn-outline" onClick={onClose}>
            {t('Close')}
          </button>
          <button
            type="button"
            className="btn-new-sale"
            disabled={product.outOfStock}
            onClick={() => {
              onAdd(product);
              onClose();
            }}
          >
            {t('Add to Sale')}
          </button>
        </div>
      </div>
    </div>
  );
}
