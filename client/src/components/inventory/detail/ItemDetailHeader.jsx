import { categoryMeta } from '../../../theme/inventoryConstants';
import ItemQrButton from '../ItemQrButton';

export default function ItemDetailHeader({ item, onShowQr, onClose }) {
  if (!item) return null;
  const meta = categoryMeta(item.category);
  const icon = item.icon || meta.icon;
  const recordId = item.itemId || item.id || item._id;

  return (
    <div className="at-detail-header at-detail-header-pinned">
      <div className="at-detail-header-left">
        <div className="at-detail-header-icon">
          <i className={`fas ${icon}`} />
        </div>
        <div className="at-detail-header-title">Item Details</div>
      </div>
      <div className="at-detail-header-right">
        <ItemQrButton
          record={item}
          onShowQr={onShowQr}
          title="View product QR code"
          variant="link"
        />
        <div className="at-detail-sku-pill">{item.sku || recordId}</div>
        {onClose ? (
          <button
            type="button"
            className="at-detail-header-close"
            onClick={onClose}
            aria-label="Close"
          >
            <i className="fas fa-times" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
