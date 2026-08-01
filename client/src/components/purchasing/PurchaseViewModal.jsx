import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { purchasesApi } from '../../api';
import { useState } from 'react';
import ModalPortal from '../common/ModalPortal';
import { normalizePurchase } from '../../utils/normalizePurchase';
import PurchaseDetailCard from './PurchaseDetailCard';

export default function PurchaseViewModal({ open, purchaseId, preview, onClose }) {
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState(preview ? normalizePurchase(preview) : null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !purchaseId) return undefined;
    if (preview) {
      setPurchase(normalizePurchase(preview));
      return undefined;
    }
    setLoading(true);
    purchasesApi
      .get(purchaseId)
      .then((res) => setPurchase(normalizePurchase(res.data.data)))
      .catch(() => setPurchase(null))
      .finally(() => setLoading(false));
  }, [open, purchaseId, preview]);

  const handleClose = useCallback(() => onClose?.(), [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && handleClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, handleClose]);

  if (!open) return null;

  const id = purchase?.purchaseId || purchaseId;

  return (
    <ModalPortal>
      <div
        className="inv-modal-detail-overlay pur-view-overlay"
        onClick={handleClose}
        role="presentation"
      >
      <div className="inv-modal-detail pur-modal-detail" onClick={(e) => e.stopPropagation()} role="dialog">
        {loading && !purchase ? (
          <div className="inv-modal-detail-loading">
            <i className="fas fa-spinner fa-spin" /> Loading purchase…
          </div>
        ) : purchase ? (
          <div className="inv-modal-detail-scroll">
            <PurchaseDetailCard purchase={purchase} />
          </div>
        ) : (
          <div className="inv-modal-detail-loading">Purchase not found</div>
        )}
        <div className="inv-modal-detail-footer">
          <button type="button" className="btn-ghost" onClick={handleClose}>
            Close
          </button>
          <button
            type="button"
            className="btn-primary-sm"
            disabled={!id}
            onClick={() => {
              handleClose();
              navigate(`/purchasing/new?edit=${encodeURIComponent(id)}`);
            }}
          >
            <i className="fas fa-pen" /> Edit Purchase
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
