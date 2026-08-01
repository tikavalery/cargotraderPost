import { useState } from 'react';
import { categoryMeta } from '../../../theme/inventoryConstants';

export default function ItemPhotoGallery({ item }) {
  const meta = categoryMeta(item?.category);
  const photos = Array.isArray(item?.photos) ? item.photos.filter(Boolean) : [];
  const [activeIndex, setActiveIndex] = useState(0);
  const color = item?.color || meta.color;
  const icon = item?.icon || meta.icon;

  const mainPhoto = photos[activeIndex];

  return (
    <div className="at-detail-gallery">
      <div className="at-detail-gallery-main">
        {mainPhoto ? (
          <img src={mainPhoto} alt={item.name} />
        ) : (
          <div
            className="at-detail-gallery-fallback"
            style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}bb 100%)` }}
          >
            <i className={`fas ${icon}`} />
            <span>Photo unavailable</span>
          </div>
        )}
      </div>
      {photos.length > 1 && (
        <div className="at-detail-gallery-thumbs">
          {photos.map((src, idx) => (
            <button
              key={src + idx}
              type="button"
              className={`at-detail-gallery-thumb${idx === activeIndex ? ' active' : ''}`}
              onClick={() => setActiveIndex(idx)}
              aria-label={`Photo ${idx + 1}`}
            >
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
