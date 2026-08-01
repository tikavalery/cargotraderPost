import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { inventoryItemsApi } from '../../../api';
import ModalPortal from '../../common/ModalPortal';
import ItemDetailCard from '../detail/ItemDetailCard';
import ItemDetailHeader from '../detail/ItemDetailHeader';

export default function ViewItemModal({
  open,
  itemId,
  previewItem,
  suppliers = [],
  onClose,
  stack = false,
  showOpenInIndividual = false,
  openInIndividualPath = null,
  onShowQr
}) {
  const [item, setItem] = useState(previewItem);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const modalRef = useRef(null);
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!open || !itemId) return undefined;

    setError(null);
    if (String(itemId).includes(':') && previewItem) {
      setItem(previewItem);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    if (previewItem) setItem(previewItem);

    inventoryItemsApi
      .get(itemId)
      .then((res) => setItem(res.data.data))
      .catch(() => {
        setError(null);
        if (previewItem) setItem(previewItem);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch only when modal opens for this id
  }, [open, itemId]);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const onKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, handleClose]);

  useEffect(() => {
    if (open) closeBtnRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || !modalRef.current) return undefined;
    const node = modalRef.current;
    const focusable = node.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const trap = (e) => {
      if (e.key !== 'Tab' || !focusable.length) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node.addEventListener('keydown', trap);
    return () => node.removeEventListener('keydown', trap);
  }, [open, item]);

  if (!open) return null;

  return (
    <ModalPortal>
      <div className={`inv-modal-detail-overlay${stack ? ' stack' : ''}`} onClick={handleClose} role="presentation">
      <div
        ref={modalRef}
        className="inv-modal-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-detail-name"
        aria-busy={loading}
        onClick={(e) => e.stopPropagation()}
      >
        {loading && !item && (
          <div className="inv-modal-detail-loading">
            <i className="fas fa-spinner fa-spin" /> Loading item details…
          </div>
        )}
        {error && !item && <div className="inv-modal-detail-loading">{error}</div>}
        {item && <ItemDetailHeader item={item} onShowQr={onShowQr} onClose={handleClose} />}
        <div className="inv-modal-detail-scroll">
          {item && (
            <div style={{ position: 'relative', opacity: loading ? 0.72 : 1, transition: 'opacity 0.2s' }}>
              {loading && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2,
                    pointerEvents: 'none'
                  }}
                >
                  <i className="fas fa-spinner fa-spin" style={{ fontSize: 24, color: 'var(--text-light)' }} />
                </div>
              )}
              <ItemDetailCard item={item} suppliers={suppliers} onShowQr={onShowQr} hideHeader />
            </div>
          )}
        </div>

        <div className="inv-modal-detail-footer">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {showOpenInIndividual && openInIndividualPath && (
              <Link to={openInIndividualPath} className="btn-secondary" style={{ textDecoration: 'none' }}>
                <i className="fas fa-box" /> Open in Individual Items
              </Link>
            )}
          </div>
          <button ref={closeBtnRef} type="button" className="btn-ghost" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
