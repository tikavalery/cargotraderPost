import { Link } from 'react-router-dom';
import { useT } from '../../i18n/LanguageContext';

function statusClass(status) {
  if (status === 'Delayed') return 'badge-delayed';
  if (status === 'Arrived') return 'badge-arrived';
  return 'badge-transit';
}

export default function ShippingSummaryCard({ shipping, loading }) {
  const t = useT();
  if (loading) return <div className="dash-card accent-teal skeleton" style={{ minHeight: 280 }} />;

  const list = shipping?.shipments || [];
  const stats = shipping?.stats || {};

  return (
    <div className="dash-card accent-teal">
      <div className="dash-card-head">
        <div className="dash-card-title">
          <i className="fas fa-ship" /> {t('Shipping Summary')}
        </div>
        <Link to="/shipping" className="dash-link">{t('View All →')}</Link>
      </div>
      <div className="dash-card-body">
        <div className="dash-ship-list">
          {list.length ? list.map((s) => (
            <Link
              key={s.id}
              to="/shipping"
              className={`dash-ship-row${s.status === 'Delayed' ? ' delayed' : ''}`}
            >
              <div className="dash-ship-icon"><i className="fas fa-anchor" /></div>
              <div className="dash-ship-main">
                <div className="dash-ship-id">{s.id}</div>
                <div className="dash-ship-route">{s.routeLabel}</div>
                <div className="dash-ship-eta">{t('ETA')} {s.eta}</div>
              </div>
              <div className="dash-ship-right">
                <span className={`dash-status ${statusClass(s.status)}`}>{t(s.status)}</span>
                <span className="dash-ship-action">
                  {s.status === 'Arrived' ? t('Confirm →') : t('Track →')}
                </span>
              </div>
            </Link>
          )) : (
            <p className="dash-empty">{t('No active shipments')}</p>
          )}
        </div>
        <div className="dash-ship-stats">
          <div><strong>{stats.active ?? 0}</strong><span>{t('Active')}</span></div>
          <div className="stat-red"><strong>{stats.delayed ?? 0}</strong><span>{t('Delayed')}</span></div>
          <div className="stat-green"><strong>{stats.arrived ?? 0}</strong><span>{t('Arrived')}</span></div>
          <div><strong>{stats.avgLandedFmt || '—'}</strong><span>{t('Avg Landed')}</span></div>
        </div>
        <Link to="/shipping" className="dash-btn-outline">{t('Create Shipment →')}</Link>
      </div>
    </div>
  );
}
