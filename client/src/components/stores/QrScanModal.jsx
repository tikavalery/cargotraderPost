import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { parseScanPayload } from '../../utils/parseScanPayload';
import { useT } from '../../i18n/LanguageContext';

const SCANNER_ID = 'pos-qr-reader';

export default function QrScanModal({ open, onClose, onScan }) {
  const t = useT();
  const scannerRef = useRef(null);
  const [manual, setManual] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!open) return undefined;

    setStatus(t('Point your camera at the item QR code'));
    setManual('');

    let scanner;
    const start = async () => {
      try {
        scanner = new Html5Qrcode(SCANNER_ID);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decoded) => {
            const code = parseScanPayload(decoded);
            if (code) {
              onScan(code);
              onClose();
            }
          },
          () => {}
        );
      } catch {
        setStatus(t('Camera unavailable — use manual SKU entry below'));
      }
    };
    start();

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
      scannerRef.current = null;
    };
  }, [open, onClose, onScan, t]);

  const handleManual = () => {
    const code = parseScanPayload(manual);
    if (code) {
      onScan(code);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="pos-modal-overlay open" onClick={onClose} role="presentation">
      <div className="pos-modal pos-modal-lg" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="pos-modal-header">
          <div className="pos-modal-title">{t('Scan QR Code')}</div>
          <button type="button" className="pos-modal-close" onClick={onClose} aria-label={t('Close')}>
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="pos-modal-body">
          <div id={SCANNER_ID} className="pos-qr-viewport" />
          <p className="pos-qr-status">{status}</p>
          <div className="pos-qr-manual">
            <input
              type="text"
              className="pos-promo-input"
              placeholder={t('Enter SKU manually…')}
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManual()}
            />
            <button type="button" className="pos-btn-scan" onClick={handleManual}>
              {t('Find')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
