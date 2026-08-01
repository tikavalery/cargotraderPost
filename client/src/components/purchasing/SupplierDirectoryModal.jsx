import { useEffect } from 'react';
import { FLAGS } from '../../utils/countryFlags';

export default function SupplierDirectoryModal({ open, onClose, suppliers, onAddNew }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="pur-modal-overlay open" onClick={onClose} role="presentation">
      <div className="pur-modal pur-modal-lg" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="pur-modal-header">
          <div>
            <div className="pur-modal-title">Supplier Directory</div>
            <div className="pur-modal-sub">All registered suppliers</div>
          </div>
          <button type="button" className="pur-modal-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="pur-modal-body">
          {suppliers.length === 0 ? (
            <p className="empty-recent">No suppliers yet. Click Add Supplier to create one.</p>
          ) : (
            <div className="table-scroll-x">
              <table className="sup-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Location</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s._id || s.supplierId}>
                    <td>
                      <div className="sup-name">{s.name}</div>
                      {s.email && <div className="sup-email">{s.email}</div>}
                    </td>
                    <td>
                      {FLAGS[s.country] || ''} {[s.city, s.country].filter(Boolean).join(', ')}
                    </td>
                    <td>★ {Number(s.rating || 4).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
        <div className="pur-modal-footer">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn-primary-sm"
            onClick={() => {
              onClose();
              onAddNew();
            }}
          >
            Add Supplier
          </button>
        </div>
      </div>
    </div>
  );
}
