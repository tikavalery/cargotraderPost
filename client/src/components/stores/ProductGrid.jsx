import ProductCard from './ProductCard';
import { CategoryFilterOptionsFlat } from '../inventory/CategorySelectOptions';
import { useT } from '../../i18n/LanguageContext';

export default function ProductGrid({
  products,
  loading,
  lookupLoading = false,
  category,
  onCategoryChange,
  search,
  onSearchChange,
  onScanClick,
  onPreview,
  onQuickAdd,
  storeName,
  onSearchKeyDown
}) {
  const t = useT();

  return (
    <div className="pos-card">
      <div className="pos-card-header">
        <div className="pos-card-title">
          <i className="fas fa-cash-register" />
          {t('POS Terminal')}
          <span className="pos-store-tag">· {storeName}</span>
        </div>
      </div>
      <div className="pos-card-body">
        <div className="pos-scan-row">
          <div className={`pos-scan-input-wrap${lookupLoading ? ' is-loading' : ''}`}>
            <i className={`fas ${lookupLoading ? 'fa-spinner fa-spin' : 'fa-barcode'}`} />
            <input
              type="text"
              className="pos-scan-input"
              placeholder={t('Scan barcode or search item…')}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={onSearchKeyDown}
              disabled={lookupLoading}
            />
          </div>
          <button
            type="button"
            className="pos-btn-scan"
            onClick={onScanClick}
            title={t('Scan')}
            aria-label={t('Scan')}
          >
            <i className="fas fa-qrcode" />
            <span className="pos-chrome-label">{t('Scan')}</span>
          </button>
        </div>

        <div className="pos-cat-filter">
          <label className="pos-cat-filter-label" htmlFor="pos-category-select">
            <i className="fas fa-tags" />
            <span className="pos-chrome-label">{t('Category')}</span>
          </label>
          <select
            id="pos-category-select"
            className="pos-cat-select"
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            aria-label={t('Category')}
          >
            <CategoryFilterOptionsFlat
              includeAll
              allLabel={t('All categories')}
              allValue="All"
              labelFn={t}
            />
          </select>
        </div>

        <div className="pos-toolbar">
          <span className="pos-toolbar-count">
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin" aria-hidden="true" /> {t('Searching…')}
              </>
            ) : products.length === 1 ? (
              t('1 product')
            ) : (
              t('{n} products', { n: products.length })
            )}
          </span>
          <span className="pos-toolbar-hint">{t('Tap to preview · double-tap quick add')}</span>
        </div>

        <div className={`pos-product-grid${loading ? ' is-loading' : ''}`}>
          {loading && (
            <div className="pos-products-loading" role="status" aria-live="polite">
              <i className="fas fa-spinner fa-spin" aria-hidden="true" />
              <p>{t('Searching products…')}</p>
            </div>
          )}
          {!loading && products.length === 0 && (
            <div className="pos-empty-products">
              <i className="fas fa-box-open" />
              <p>{t('No products on this store shelf yet.')}</p>
              <span>{t('Scan a barcode or search inventory to add products to this store.')}</span>
            </div>
          )}
          {!loading &&
            products.map((p) => (
              <ProductCard key={p.productId} product={p} onPreview={onPreview} onQuickAdd={onQuickAdd} />
            ))}
        </div>
      </div>
    </div>
  );
}
