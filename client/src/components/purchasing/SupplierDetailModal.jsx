import { Link } from 'react-router-dom';
import { FLAGS } from '../../utils/countryFlags';
import { formatCurrency } from '../../utils/formatCurrency';

export default function SupplierDetailModal({
  open,
  supplier,
  recentPurchases = [],
  onClose,
  onEdit,
  onDelete,
  canManage
}) {
  if (!open || !supplier) return null;

  const location = [supplier.city, supplier.country].filter(Boolean).join(', ');

  return (
    <div className="pur-modal-overlay open" onClick={onClose} role="presentation">
      <div className="pur-modal pur-modal-lg" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="pur-modal-header">
          <div>
            <div className="pur-modal-title">
              {FLAGS[supplier.country] || ''} {supplier.name}
            </div>
            <div className="pur-modal-sub">{supplier.supplierId}</div>
          </div>
          <button type="button" className="pur-modal-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="pur-modal-body">
          <div className="sup-detail-grid">
            <div className="sup-detail-stat">
              <span className="sup-detail-label">Location</span>
              <strong>{location || '—'}</strong>
            </div>
            <div className="sup-detail-stat">
              <span className="sup-detail-label">Rating</span>
              <strong>★ {Number(supplier.rating || 4).toFixed(1)}</strong>
            </div>
            <div className="sup-detail-stat">
              <span className="sup-detail-label">Purchases</span>
              <strong>{supplier.purchaseCount ?? 0}</strong>
            </div>
            <div className="sup-detail-stat">
              <span className="sup-detail-label">Total Value</span>
              <strong>{formatCurrency(supplier.totalPurchaseValue || 0)}</strong>
            </div>
          </div>

          {(supplier.email || supplier.phone) && (
            <div className="sup-detail-contact">
              {supplier.email && (
                <a href={`mailto:${supplier.email}`} className="sup-contact-link">
                  <i className="fas fa-envelope" /> {supplier.email}
                </a>
              )}
              {supplier.phone && (
                <span className="sup-contact-link">
                  <i className="fas fa-phone" /> {supplier.phone}
                </span>
              )}
            </div>
          )}

          <div className="sup-recent-header">
            <h3>Recent Purchases</h3>
            {(supplier.purchaseCount ?? 0) > 0 && (
              <Link
                to={`/purchasing/all?supplier=${encodeURIComponent(supplier.supplierId)}`}
                className="link-btn"
                onClick={onClose}
              >
                View all →
              </Link>
            )}
          </div>

          {recentPurchases.length === 0 ? (
            <p className="empty-recent">No purchases from this supplier yet.</p>
          ) : (
            <div className="table-scroll-x">
              <table className="sup-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Value</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPurchases.map((p) => (
                    <tr key={p.purchaseId || p.id}>
                      <td>
                        <div className="sup-name">{p.itemName}</div>
                        <div className="sup-email">{p.purchaseId || p.id}</div>
                      </td>
                      <td>{p.quantity}</td>
                      <td>{formatCurrency(p.purchaseValue || p.purchasePrice * p.quantity)}</td>
                      <td>{p.purchaseDate || '—'}</td>
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
          {canManage && (
            <>
              <button type="button" className="btn-ghost" onClick={() => onEdit(supplier)}>
                <i className="fas fa-pen" /> Edit
              </button>
              <button type="button" className="btn-ghost sup-delete-btn" onClick={() => onDelete(supplier)}>
                <i className="fas fa-trash" /> Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
