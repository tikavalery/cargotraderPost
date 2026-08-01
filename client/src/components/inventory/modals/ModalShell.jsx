import { useEffect } from 'react';
import ModalPortal from '../../common/ModalPortal';

export default function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = '',
  elevated = false
}) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <ModalPortal>
      <div
        className={`inv-modal-overlay open${elevated ? ' elevated' : ''}`}
        onClick={onClose}
        role="presentation"
      >
        <div
          className={`inv-modal ${size}`.trim()}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="inv-modal-header">
            <div>
              <div className="inv-modal-title" id="modal-title">
                {title}
              </div>
              {subtitle && <div className="inv-modal-sub">{subtitle}</div>}
            </div>
            <button type="button" className="inv-modal-close" onClick={onClose} aria-label="Close">
              <i className="fas fa-times" />
            </button>
          </div>
          <div className="inv-modal-body">{children}</div>
          {footer && <div className="inv-modal-footer">{footer}</div>}
        </div>
      </div>
    </ModalPortal>
  );
}
