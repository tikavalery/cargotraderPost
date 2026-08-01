import { categoryMeta } from '../../theme/inventoryConstants';

export default function ItemPhotoCell({ photos = [], category, size = 40 }) {
  const meta = categoryMeta(category);
  const extra = photos.length > 1 ? photos.length - 1 : 0;

  if (photos[0]) {
    return (
      <div className="pur-photo-cell" style={{ width: size, height: size }}>
        <img src={photos[0]} alt="" className="pur-photo-img" />
        {extra > 0 && <span className="pur-photo-badge">+{extra}</span>}
      </div>
    );
  }

  return (
    <div
      className="pur-photo-cell pur-photo-placeholder"
      style={{ width: size, height: size, background: `${meta.color}22`, color: meta.color }}
    >
      <i className={`fas ${meta.icon}`} />
    </div>
  );
}
