import { useT } from '../../i18n/LanguageContext';

export default function ShippingNavbarExtras({ onNewShipment, showNewShipment = true }) {
  const t = useT();

  if (!showNewShipment) return null;

  return (
    <div className="ship-nav-extras">
      <button
        type="button"
        className="btn-new-shipment"
        onClick={onNewShipment}
        aria-label={t('New Shipment')}
        title={t('New Shipment')}
      >
        <i className="fas fa-plus" aria-hidden />
        <span className="btn-new-shipment-label">{t('New Shipment')}</span>
      </button>
    </div>
  );
}
