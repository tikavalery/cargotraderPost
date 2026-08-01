import ItemPhotoCell from './ItemPhotoCell';

export default function PhotoThumbnail({ src, category, active, onClick }) {
  if (src) {
    return (
      <button
        type="button"
        className={`at-detail-gallery-thumb${active ? ' active' : ''}`}
        onClick={onClick}
      >
        <img src={src} alt="" />
      </button>
    );
  }
  return <ItemPhotoCell photos={[]} category={category} size={64} />;
}
