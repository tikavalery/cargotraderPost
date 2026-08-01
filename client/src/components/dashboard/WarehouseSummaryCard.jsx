import { Link } from 'react-router-dom';
import { useT } from '../../i18n/LanguageContext';

export default function WarehouseSummaryCard({ warehouses, loading }) {
  const t = useT();
  if (loading) return <div className="dash-card accent-navy skeleton" style={{ minHeight: 200 }} />;

  const rows = warehouses || [];

  return (
    <div className="dash-card accent-navy">
      <div className="dash-card-head">
        <div className="dash-card-title">
          <i className="fas fa-warehouse" /> {t('Warehouse Summary')}
        </div>
        <Link to="/warehouses" className="dash-link">{t('View All →')}</Link>
      </div>
      <div className="dash-card-body">
        {rows.length ? rows.map((w) => (
          <div key={w.id} className="dash-wh-row">
            <div>
              <div className="dash-wh-name">{w.flag} {w.name}</div>
              <div className="dash-wh-sub">
                {t('{count} items stored', { count: (w.itemsCount ?? 0).toLocaleString('en-US') })}
              </div>
            </div>
          </div>
        )) : (
          <p className="dash-empty">{t('No warehouses configured')}</p>
        )}
        <Link to="/warehouses" className="dash-footer-link">{t('Add Warehouse →')}</Link>
      </div>
    </div>
  );
}
