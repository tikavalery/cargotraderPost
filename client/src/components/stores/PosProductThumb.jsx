export default function PosProductThumb({ image, icon = 'fa-box', color, className = '', iconClassName = '' }) {
  if (image) {
    return <img src={image} alt="" className={`pos-product-photo ${className}`.trim()} />;
  }
  return (
    <i
      className={`fas ${icon} ${iconClassName}`.trim()}
      style={{ color: color || 'var(--text-light)' }}
    />
  );
}
