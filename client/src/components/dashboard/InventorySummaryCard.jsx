import { Link } from 'react-router-dom';
import { useT } from '../../i18n/LanguageContext';

export default function InventorySummaryCard({ inventory, loading }) {
  const t = useT();
  if (loading) return <div className="dash-card accent-orange skeleton" style={{ minHeight: 220 }} />;

  const inv = inventory || {};
  const cats = inv.byCategory || [];
  const whCount = inv.warehouseCount ?? 0;

  return (
    <div className="dash-card accent-orange">
      <div className="dash-card-head">
        <div className="dash-card-title">
          <i className="fas fa-boxes" /> {t('Inventory Summary')}
        </div>
        <Link to="/inventory/items" className="dash-link">{t('View All →')}</Link>
      </div>
      <div className="dash-card-body">
        <div className="dash-stat-grid">
          <div className="dash-stat">
            <div className="dash-stat-label">{t('Total Items')}</div>
            <div className="dash-stat-value">{inv.totalRecords ?? 0}</div>
            <div className="dash-stat-sub">
              {t('across {count} warehouses', { count: whCount })}
            </div>
          </div>
          <div className="dash-stat">
            <div className="dash-stat-label">{t('Total Value')}</div>
            <div className="dash-stat-value dash-stat-green">{inv.totalValueFmt || '—'}</div>
          </div>
        </div>
        <div className="dash-section-label" style={{ marginTop: 16 }}>{t('By Category')}</div>
        {cats.length ? cats.map((c) => (
          <div key={c.name} className="dash-cat-row">
            <span className="dash-cat-name">{t(c.name)}</span>
            <div className="dash-cat-bar-track">
              <div className="dash-cat-bar-fill" style={{ width: `${c.pct}%`, background: c.color }} />
            </div>
            <span className="dash-cat-pct">{c.pct}%</span>
          </div>
        )) : (
          <p className="dash-empty">{t('No category data yet')}</p>
        )}
        <Link to="/inventory/items" className="dash-footer-link">{t('Manage Inventory →')}</Link>
      </div>
    </div>
  );
}
