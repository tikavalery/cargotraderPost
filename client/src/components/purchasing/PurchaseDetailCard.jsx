import PurchaseStatusBadge, { categoryMeta } from '../inventory/StatusBadge';
import { formatCurrency } from '../../utils/formatCurrency';
import { FLAGS } from '../../utils/countryFlags';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import PhotoThumbnail from '../inventory/PhotoThumbnail';

export default function PurchaseDetailCard({ purchase }) {
  const [mainPhoto, setMainPhoto] = useState(0);
  if (!purchase) return null;

  const meta = categoryMeta(purchase.category);
  const photos = purchase.photos || [];
  const supplier = purchase.supplier;
  const supplierId = supplier?.supplierId || purchase.supplierId;
  const supplierDisplay = supplier
    ? `${FLAGS[supplier.country] || ''} ${supplier.name}`.trim()
    : purchase.supplierName || '—';

  return (
    <div className="at-detail-card wh-item-card">
      <div className="at-detail-header">
        <div className="at-detail-header-left">
          <div className="at-detail-header-icon" style={{ background: `${meta.color}33` }}>
            <i className={`fas ${meta.icon}`} style={{ color: meta.color }} />
          </div>
          <div>
            <div className="at-detail-header-title">Purchase Details</div>
            <div className="at-detail-sku-pill" style={{ marginTop: 4 }}>
              {purchase.purchaseId || purchase.id}
            </div>
          </div>
        </div>
      </div>

      <div className="at-detail-stats">
        <div className="at-detail-stat">
          <div className="at-detail-stat-icon orange">
            <i className="fas fa-tag" />
          </div>
          <div>
            <div className="at-detail-stat-label">Purchase Price</div>
            <div className="at-detail-stat-value">{formatCurrency(purchase.purchasePrice)}</div>
            <div className="at-detail-stat-sub">per unit</div>
          </div>
        </div>
        <div className="at-detail-stat">
          <div className="at-detail-stat-icon green">
            <i className="fas fa-bullseye" />
          </div>
          <div>
            <div className="at-detail-stat-label">Target Price</div>
            <div className="at-detail-stat-value">{formatCurrency(purchase.targetPrice)}</div>
            <div className="at-detail-stat-sub">per unit</div>
          </div>
        </div>
        <div className="at-detail-stat">
          <div className="at-detail-stat-icon" style={{ background: 'rgba(26,60,94,0.12)', color: '#1a3c5e' }}>
            <i className="fas fa-cubes" />
          </div>
          <div>
            <div className="at-detail-stat-label">Quantity</div>
            <div className="at-detail-stat-value">{purchase.quantity}</div>
            <div className="at-detail-stat-sub">units</div>
          </div>
        </div>
      </div>

      <div className="at-detail-body">
        <div className="at-detail-body-grid">
          {photos.length > 0 ? (
            <div>
              <div className="at-detail-gallery-main">
                <img src={photos[mainPhoto] || photos[0]} alt="" />
              </div>
              {photos.length > 1 && (
                <div className="at-detail-gallery-thumbs">
                  {photos.map((src, i) => (
                    <PhotoThumbnail
                      key={src.slice(0, 32) + i}
                      src={src}
                      active={i === mainPhoto}
                      onClick={() => setMainPhoto(i)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="at-detail-gallery-main">
                <div
                  className="at-detail-gallery-fallback"
                  style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)` }}
                >
                  <i className={`fas ${meta.icon}`} />
                  <span>{purchase.category}</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <h2 className="at-detail-name">{purchase.itemName}</h2>
            <div className="at-detail-meta">
              <span>
                <i className="fas fa-calendar" />
                {purchase.purchaseDate || '—'}
              </span>
              <span>
                <i className="fas fa-folder" />
                {purchase.category}
              </span>
            </div>

            <div className="at-detail-field-grid">
              <Field label="Category" value={purchase.category} />
              <Field label="SKU" value={purchase.sku || '—'} />
              <Field label="Quantity" value={`${purchase.quantity} units`} />
              <Field label="Location" value={purchase.location || '—'} />
              <Field label="Purchase Price" value={formatCurrency(purchase.purchasePrice)} />
              <Field label="Target Price" value={formatCurrency(purchase.targetPrice)} />
              <Field
                label="Supplier"
                value={
                  supplierId && supplierDisplay !== '—' ? (
                    <Link
                      to={`/purchasing/all?supplier=${encodeURIComponent(supplierId)}`}
                      className="sup-purchase-link"
                    >
                      {supplierDisplay}
                    </Link>
                  ) : (
                    supplierDisplay
                  )
                }
              />
              <Field label="Date Purchased" value={purchase.purchaseDate || '—'} />
              <Field
                label="Record Status"
                value={<PurchaseStatusBadge status={purchase.status} />}
              />
            </div>

            {purchase.notes?.trim() && (
              <div className="at-detail-notes pur-detail-notes">
                <div className="at-detail-field-label">
                  <i className="fas fa-info-circle" style={{ color: '#14b8a6', marginRight: 4 }} />
                  Notes
                </div>
                <div className="at-detail-notes-body">{purchase.notes}</div>
              </div>
            )}

            <div className="at-detail-tags">
              <span className="at-detail-category-chip">
                <i className={`fas ${meta.icon}`} />
                {purchase.category}
              </span>
              <PurchaseStatusBadge status={purchase.status} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="at-detail-field">
      <div className="at-detail-field-label">{label}</div>
      <div className="at-detail-field-value">{value}</div>
    </div>
  );
}
