export default function ScanFilterBanner({ label, onClear }) {
  if (!label) return null;

  return (
    <div className="inv-scan-filter-banner" role="status">
      <div className="inv-scan-filter-banner-text">
        <i className="fas fa-qrcode" aria-hidden />
        <span>
          Showing scan result: <strong>{label}</strong>
        </span>
      </div>
      <button type="button" className="btn-ghost btn-sm" onClick={onClear}>
        Show all items
      </button>
    </div>
  );
}
