import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useToast } from '../../../context/ToastContext';
import { buildItemQrPayload } from '../../../utils/itemQr';
import ModalShell from './ModalShell';

export default function ViewQrModal({ open, record, onClose }) {
  const { showToast } = useToast();
  const [dataUrl, setDataUrl] = useState('');
  const payload = record ? buildItemQrPayload(record) : '';

  useEffect(() => {
    if (!open || !payload) {
      setDataUrl('');
      return undefined;
    }
    let cancelled = false;
    QRCode.toDataURL(payload, {
      width: 240,
      margin: 2,
      color: { dark: '#1A3C5E', light: '#FFFFFF' }
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [open, payload]);

  const handleCopy = async () => {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload);
      showToast('QR code value copied', 'success');
    } catch {
      showToast('Could not copy to clipboard');
    }
  };

  const handleDownload = () => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${record.sku || 'product'}-qr.png`;
    link.click();
  };

  return (
    <ModalShell
      open={open && Boolean(record)}
      onClose={onClose}
      elevated
      title="Product QR Code"
      subtitle={record?.name}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn-secondary" onClick={handleCopy} disabled={!payload}>
            <i className="fas fa-copy" /> Copy Code
          </button>
          <button type="button" className="btn-scan" onClick={handleDownload} disabled={!dataUrl}>
            <i className="fas fa-download" /> Download PNG
          </button>
        </>
      }
    >
      <div className="inv-qr-view">
        <div className="inv-qr-image-wrap">
          {dataUrl ? (
            <img src={dataUrl} alt={`QR code for ${record?.sku}`} className="inv-qr-image" />
          ) : (
            <div className="inv-qr-loading">
              <i className="fas fa-spinner fa-spin" /> Generating QR code…
            </div>
          )}
        </div>
        <div className="inv-qr-meta">
          <div className="inv-qr-meta-row">
            <span className="inv-qr-meta-label">SKU</span>
            <span className="inv-qr-meta-value">{record?.sku || '—'}</span>
          </div>
          <div className="inv-qr-meta-row">
            <span className="inv-qr-meta-label">Type</span>
            <span className="inv-qr-meta-value">
              Individual Item
            </span>
          </div>
          {record?.subtitle ? (
            <div className="inv-qr-meta-row">
              <span className="inv-qr-meta-label">Details</span>
              <span className="inv-qr-meta-value">{record.subtitle}</span>
            </div>
          ) : null}
          <div className="inv-qr-payload" title={payload}>
            <span className="inv-qr-meta-label">Scan value</span>
            <code>{payload}</code>
          </div>
          <p className="inv-qr-hint">Scan at POS or use the inventory scanner to look up this product.</p>
        </div>
      </div>
    </ModalShell>
  );
}
