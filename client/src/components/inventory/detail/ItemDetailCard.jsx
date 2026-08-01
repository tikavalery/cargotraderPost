import { categoryMeta } from '../../../theme/inventoryConstants';
import { statusBadgeClass } from '../../../utils/itemDetail';
import ItemQrDetailBlock from '../ItemQrDetailBlock';
import ItemDetailStats from './ItemDetailStats';
import ItemPhotoGallery from './ItemPhotoGallery';
import ItemDetailFieldGrid from './ItemDetailFieldGrid';
import ItemDetailHeader from './ItemDetailHeader';

export default function ItemDetailCard({ item, suppliers = [], onShowQr, hideHeader = false }) {
  if (!item) return null;
  const meta = categoryMeta(item.category);

  return (
    <div className="at-detail-card">
      {!hideHeader && <ItemDetailHeader item={item} onShowQr={onShowQr} />}

      <ItemDetailStats item={item} />

      <div className="at-detail-body">
        <div className="at-detail-body-grid">
          <div>
            <ItemPhotoGallery item={item} />
          </div>
          <div>
            <h2 className="at-detail-name" id="item-detail-name">
              {item.name}
            </h2>
            <div className="at-detail-meta">
              <span>
                <i className="fas fa-cubes" />
                <strong>{item.qty ?? 0}</strong> units
              </span>
              <span>
                <i className="fas fa-folder" />
                {item.category || '—'}
              </span>
            </div>

            <ItemDetailFieldGrid item={item} suppliers={suppliers} />

            <ItemQrDetailBlock record={item} onShowQr={onShowQr} />

            <div className="at-detail-notes">
              <div className="at-detail-field-label">Notes</div>
              <div className="at-detail-notes-body">{item.notes?.trim() ? item.notes : '—'}</div>
            </div>

            <div className="at-detail-tags">
              {item.category && (
                <span className="at-detail-category-chip">
                  <i className={`fas ${meta.icon}`} />
                  {item.category}
                </span>
              )}
              {item.status && (
                <span className={`status-badge ${statusBadgeClass(item.status)}`}>{item.status}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
