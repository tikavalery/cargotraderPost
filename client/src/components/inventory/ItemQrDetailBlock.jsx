import { buildItemQrPayload, toQrRecord } from '../../utils/itemQr';

export default function ItemQrDetailBlock({ record, type, subtitle, onShowQr, label = 'Product QR Code' }) {
  if (!onShowQr || !record) return null;
  const qrRecord = toQrRecord(record, { type, subtitle });
  if (!qrRecord.sku) return null;
  const payload = buildItemQrPayload(qrRecord);

  return (
    <div className="at-detail-qr-block">
      <div className="at-detail-field-label">{label}</div>
      <button
        type="button"
        className="at-detail-qr-link"
        title={`${label}: ${payload}`}
        aria-label={`${label}: ${record.name || qrRecord.sku}`}
        onClick={(e) => {
          e.stopPropagation();
          onShowQr(qrRecord);
        }}
      >
        <span className="at-detail-qr-link-main">
          <i className="fas fa-qrcode" aria-hidden />
          <span>View QR Code</span>
        </span>
        <code className="at-detail-qr-payload">{payload}</code>
      </button>
    </div>
  );
}
