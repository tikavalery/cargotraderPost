import PurchaseFormSection from './PurchaseFormSection';
import SupplierSelect from './SupplierSelect';
import PhotoUpload from './PhotoUpload';
import PurchaseAiPhotoSection from './PurchaseAiPhotoSection';
import { applyAiToPurchaseForm } from '../../utils/purchaseAi';
import { CategorySelectOptions } from '../../theme/inventoryConstants';
import { useT } from '../../i18n/LanguageContext';

export default function PurchaseForm({
  form,
  setForm,
  groups,
  itemGroups = [],
  suppliers,
  editing,
  saving,
  onSave,
  onDraft,
  onClear,
  onAddSupplier
}) {
  const t = useT();
  const set = (key) => (e) => {
    const val = e.target.type === 'number' ? e.target.value : e.target.value;
    setForm((f) => ({ ...f, [key]: val }));
  };

  return (
    <div className="form-card" id="purchase-form-card">
      <div className="form-card-header">
        <div className="form-card-title">
          <i className={`fas ${editing ? 'fa-pen' : 'fa-plus-circle'}`} />
          {editing ? 'Edit Purchase' : 'New Purchase'}
        </div>
      </div>
      <div className="form-card-body">
        {!editing && (
          <PurchaseAiPhotoSection
            photos={form.photos}
            onPhotosChange={(next) => setForm((f) => ({ ...f, photos: next }))}
            onAnalysisApply={(data) => setForm((f) => applyAiToPurchaseForm(f, data))}
          />
        )}

        <PurchaseFormSection icon="fa-box" title="Inventory Item">
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">
                Item Name <span className="req">*</span>
              </label>
              <input
                className="form-input"
                placeholder="e.g. Nike AF1 Sneakers"
                value={form.itemName}
                onChange={set('itemName')}
              />
            </div>
            <div className="form-group">
              <label className="form-label">SKU</label>
              <input
                className="form-input"
                placeholder="Auto-generated if empty"
                value={form.sku}
                onChange={set('sku')}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category} onChange={set('category')}>
                <CategorySelectOptions />
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Group / Bale (optional)</label>
              <input
                className="form-input"
                list="purchase-group-suggestions"
                placeholder="e.g. Bale-001, Summer Clothes"
                value={form.group || ''}
                onChange={set('group')}
              />
              <datalist id="purchase-group-suggestions">
                {itemGroups.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </div>
            <div className="form-group">
              <label className="form-label">Condition / Grade</label>
              <input
                className="form-input"
                placeholder="e.g. New, Like New, Good, Fair"
                value={form.condition || ''}
                onChange={set('condition')}
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Quantity <span className="req">*</span>
              </label>
              <input
                type="number"
                min="0"
                className="form-input"
                value={form.quantity}
                onChange={set('quantity')}
              />
              {editing && (
                <p className="form-hint" style={{ marginTop: 6, fontSize: 11, color: 'var(--text-light)' }}>
                  {t(
                    'Changing quantity updates inventory stock and the finance expense. You cannot go below units already sold or transferred.'
                  )}
                </p>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Location</label>
              <select className="form-select" value={form.location} onChange={set('location')}>
                <option value="">Select location…</option>
                {groups.map((grp) => (
                  <optgroup key={grp.label} label={grp.label}>
                    {grp.items.map((item) => (
                      <option key={item.id || item.name} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">
                Purchase Price (XAF) <span className="req">*</span>
              </label>
              <input
                type="number"
                min="0"
                className="form-input"
                placeholder="Cost per unit"
                value={form.purchasePrice}
                onChange={set('purchasePrice')}
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Target Price (XAF) <span className="req">*</span>
              </label>
              <input
                type="number"
                min="0"
                className="form-input"
                placeholder="Per unit"
                value={form.targetPrice}
                onChange={set('targetPrice')}
              />
            </div>
          </div>
          <PhotoUpload
            photos={form.photos}
            onChange={(next) => setForm((f) => ({ ...f, photos: next }))}
            compact={!editing}
          />
        </PurchaseFormSection>

        <PurchaseFormSection icon="fa-truck" title="Purchase Details">
          <div className="pur-details-grid">
            <SupplierSelect
              suppliers={suppliers}
              value={form.supplierId}
              onChange={(supplierId) => setForm((f) => ({ ...f, supplierId }))}
              onAddSupplier={onAddSupplier}
            />
            <div className="form-group">
              <label className="form-label">
                Date of Purchase <span className="req">*</span>
              </label>
              <input
                type="date"
                className="form-input"
                value={form.purchaseDate}
                onChange={set('purchaseDate')}
              />
            </div>
          </div>
          <div className="form-group pur-notes-group">
            <label className="form-label">Notes (optional)</label>
            <textarea
              className="form-textarea"
              maxLength={500}
              placeholder="Supplier reference, inspection notes..."
              value={form.notes}
              onChange={set('notes')}
              rows={3}
            />
            <div className="char-count">{form.notes.length} / 500</div>
          </div>
        </PurchaseFormSection>

        <div className="form-actions">
          <button type="button" className="btn-save" disabled={saving} onClick={() => onSave('saved')}>
            <i className="fas fa-check" /> Save Purchase
          </button>
          <button type="button" className="btn-draft" disabled={saving} onClick={() => onSave('draft')}>
            <i className="fas fa-file" /> Save as Draft
          </button>
          <button type="button" className="btn-reset" onClick={onClear}>
            <i className="fas fa-undo" /> Clear Form
          </button>
        </div>
      </div>
    </div>
  );
}
