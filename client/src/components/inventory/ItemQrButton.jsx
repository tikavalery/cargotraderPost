import { toQrRecord } from '../../utils/itemQr';

export default function ItemQrButton({
  record,
  type,
  subtitle,
  onShowQr,
  title = 'View QR code',
  variant = 'icon'
}) {
  if (!onShowQr || !record) return null;
  const qrRecord = toQrRecord(record, { type, subtitle });
  if (!qrRecord.sku) return null;

  const className = variant === 'link' ? 'inv-qr-link' : 'inv-qr-btn';

  return (
    <button
      type="button"
      className={className}
      title={title}
      aria-label={`${title}: ${record.name || qrRecord.sku}`}
      onClick={(e) => {
        e.stopPropagation();
        onShowQr(qrRecord);
      }}
    >
      <i className="fas fa-qrcode" aria-hidden />
      {variant === 'link' ? <span>View QR Code</span> : null}
    </button>
  );
}
