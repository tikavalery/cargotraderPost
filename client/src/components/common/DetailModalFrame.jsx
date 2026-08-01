import { useCallback, useEffect, useRef } from 'react';
import ModalPortal from './ModalPortal';

export default function DetailModalFrame({
  open,
  stack = false,
  onClose,
  header,
  footer,
  children,
  ariaLabelledBy
}) {
  const modalRef = useRef(null);
  const closeBtnRef = useRef(null);

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

  if (!open) return null;

  return (
    <ModalPortal>
      <div
        className={`inv-modal-detail-overlay${stack ? ' stack' : ''}`}
        onClick={handleClose}
        role="presentation"
      >
        <div
          ref={modalRef}
          className="inv-modal-detail"
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabelledBy}
          onClick={(e) => e.stopPropagation()}
        >
          {header}
          <div className="inv-modal-detail-scroll">{children}</div>
          <div className="inv-modal-detail-footer">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{footer?.left}</div>
            <button ref={closeBtnRef} type="button" className="btn-ghost" onClick={handleClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
