import { useRef } from 'react';
import { formatXaf } from '../../utils/format';
import { useT } from '../../i18n/LanguageContext';

export default function SaleSuccessModal({ open, onClose, receipt }) {
  const t = useT();
  const printRef = useRef(null);

  if (!receipt) return null;

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank', 'width=320,height=480');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html><head><title>${t('Receipt')} ${receipt.transactionId}</title>
      <style>
        body { font-family: monospace; font-size: 12px; padding: 16px; max-width: 280px; margin: 0 auto; }
        h1 { font-size: 14px; text-align: center; margin: 0 0 8px; }
        .line { display: flex; justify-content: space-between; margin: 4px 0; }
        hr { border: none; border-top: 1px dashed #999; margin: 8px 0; }
        .total { font-weight: bold; font-size: 14px; }
      </style></head><body>${content.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  return (
    <div className={`pos-modal-overlay${open ? ' open' : ''}`} onClick={onClose} role="presentation">
      <div className="pos-modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="pos-modal-body pos-success-body">
          <div className="pos-success-icon">
            <i className="fas fa-check" />
          </div>
          <h2>{t('Sale Complete!')}</h2>
          <div ref={printRef} className="pos-receipt-preview">
            <p>
              {t('Receipt')} <strong>{receipt.transactionId}</strong>
            </p>
            <p>
              {formatXaf(receipt.total)} · {t(receipt.payment || 'Cash')}
            </p>
          </div>
          <div className="pos-success-actions">
            <button type="button" className="btn-ghost pos-print-btn" onClick={handlePrint}>
              <i className="fas fa-print" /> {t('Print Receipt')}
            </button>
            <button type="button" className="btn-new-sale" onClick={onClose}>
              {t('New Sale')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
