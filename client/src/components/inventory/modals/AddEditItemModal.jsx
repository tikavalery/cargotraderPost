import { useEffect, useState } from 'react';
import ModalShell from './ModalShell';
import { CategorySelectOptions } from '../../../theme/inventoryConstants';
import { normalizeImageFile } from '../../../utils/imageUpload';
import { resolvePhotosForSave } from '../../../utils/cloudinaryUpload';
import { useToast } from '../../../context/ToastContext';
import { useCurrency } from '../../../context/CurrencyContext';
import { fromXaf, toXaf } from '../../../constants/financeConstants';
import { useT } from '../../../i18n/LanguageContext';

const emptyForm = () => ({
  name: '',
  sku: '',
  category: 'Clothes',
  group: '',
  qty: 1,
  location: '',
  purchasePrice: '',
  targetPrice: '',
  supplierId: '',
  purchaseDate: new Date().toISOString().slice(0, 10),
  notes: '',
  photos: []
});

export default function AddEditItemModal({
  open,
  mode,
  item,
  locations,
  suppliers,
  groups = [],
  onClose,
  onSave,
  onManageGroups
}) {
  const t = useT();
  const { currency } = useCurrency();
  const { showToast } = useToast();
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && item) {
      const targetXaf = Number(item.targetPrice ?? item.priceXaf) || 0;
      const purchaseXaf = Number(item.purchasePrice) || 0;
      setForm({
        name: item.name || '',
        sku: item.sku || '',
        category: item.category || 'Clothes',
        group: item.group || '',
        qty: item.qty ?? 1,
        location: item.location || '',
        // Prices are stored in XAF; show them in the user's preferred currency.
        purchasePrice: purchaseXaf ? fromXaf(purchaseXaf, currency) : '',
        targetPrice: targetXaf ? fromXaf(targetXaf, currency) : '',
        supplierId: item.supplierId || '',
        purchaseDate: item.purchaseDate || new Date().toISOString().slice(0, 10),
        notes: item.notes || '',
        photos: item.photos || []
      });
    } else {
      setForm({ ...emptyForm(), location: locations[0] || '' });
    }
  }, [open, mode, item, locations, currency]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handlePhotos = async (e) => {
    const files = [...e.target.files].slice(0, 12 - form.photos.length);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    try {
      const normalized = await Promise.all(files.map((f) => normalizeImageFile(f)));
      setForm((f) => ({ ...f, photos: [...f.photos, ...normalized].slice(0, 12) }));
    } catch {
      showToast('Could not process one or more photos');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (idx) => {
    setForm((f) => ({ ...f, photos: f.photos.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      let photos = form.photos;
      try {
        photos = await resolvePhotosForSave(photos);
      } catch (upErr) {
        showToast(upErr.response?.data?.message || 'Photo upload failed');
        return;
      }

      const payload = {
        ...form,
        photos,
        group: form.group.trim() || null,
        // Convert display currency → XAF so dashboard / finance totals stay consistent.
        targetPrice: toXaf(Number(form.targetPrice) || 0, currency)
      };
      if (mode === 'edit') {
        delete payload.qty;
        // Purchase cost is owned by Purchases → Finance; do not change from inventory edit.
        delete payload.purchasePrice;
        delete payload.purchaseValue;
      } else {
        payload.qty = Number(form.qty) || 0;
        payload.purchasePrice = toXaf(Number(form.purchasePrice) || 0, currency);
      }
      await onSave(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const isEdit = mode === 'edit';

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Item' : 'Add New Item'}
      subtitle={isEdit ? 'Update inventory record' : 'Add loose stock from a purchase'}
      size="inv-modal-lg"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="add-item-form" className="btn-add" disabled={saving || uploading}>
            <i className={`fas ${saving || uploading ? 'fa-spinner fa-spin' : isEdit ? 'fa-save' : 'fa-plus'}`} />
            {isEdit ? 'Save Changes' : 'Add Item'}
          </button>
        </>
      }
    >
      <form id="add-item-form" className="inv-add-item-form" onSubmit={handleSubmit}>
        <div className="form-grid-2">
          <div className="form-group form-group-full">
            <label className="form-label">Item Name *</label>
            <input className="form-input" value={form.name} onChange={set('name')} required />
          </div>
          <div className="form-group">
            <label className="form-label">SKU</label>
            <input className="form-input" value={form.sku} onChange={set('sku')} placeholder="Auto-generated if empty" />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-select" value={form.category} onChange={set('category')}>
              <CategorySelectOptions />
            </select>
          </div>
          <div className="form-group">
            <div className="form-label-row">
              <label className="form-label" htmlFor="item-group-input">Group / Bale (optional)</label>
              {onManageGroups && (
                <button
                  type="button"
                  className="inv-group-manage-link"
                  onClick={onManageGroups}
                >
                  <i className="fas fa-plus" /> Add group
                </button>
              )}
            </div>
            <input
              id="item-group-input"
              className="form-input"
              list="item-group-suggestions"
              value={form.group}
              onChange={set('group')}
              placeholder={groups.length ? 'Select or type a group' : 'Add a group first, or type a new name'}
            />
            <datalist id="item-group-suggestions">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
          <div className="form-group">
            <label className="form-label">Quantity</label>
            <input
              className="form-input"
              type="number"
              min="0"
              value={form.qty}
              onChange={set('qty')}
              disabled={isEdit}
              readOnly={isEdit}
              title={isEdit ? 'Quantity cannot be edited here — use transfers or sales' : undefined}
            />
            {isEdit && (
              <p className="form-hint" style={{ marginTop: 6, fontSize: 11, color: 'var(--text-light)' }}>
                {t('Quantity is locked to protect stock and financial values. Adjust stock via transfers or sales.')}
              </p>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Location</label>
            <select className="form-select" value={form.location} onChange={set('location')}>
              <option value="">Select location</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t('Purchase Price')} ({currency})</label>
            <input
              className="form-input"
              type="number"
              min="0"
              step="any"
              value={form.purchasePrice}
              onChange={set('purchasePrice')}
              disabled={isEdit}
              readOnly={isEdit}
              title={
                isEdit
                  ? t('Purchase price cannot be edited here — edit the purchase so Finance stays in sync')
                  : undefined
              }
            />
            {isEdit && (
              <p className="form-hint" style={{ marginTop: 6, fontSize: 11, color: 'var(--text-light)' }}>
                {t('Purchase price is locked so Expenses stay aligned with Purchases. Change cost from All Purchases (edit the purchase).')}
              </p>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">{t('Target Price')} ({currency})</label>
            <input
              className="form-input"
              type="number"
              min="0"
              step="any"
              value={form.targetPrice}
              onChange={set('targetPrice')}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Supplier</label>
            <select className="form-select" value={form.supplierId} onChange={set('supplierId')}>
              <option value="">—</option>
              {suppliers.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Date Purchased</label>
            <input className="form-input" type="date" value={form.purchaseDate} onChange={set('purchaseDate')} />
          </div>
          <div className="form-group form-group-full">
            <label className="form-label">Photos (up to 12){uploading ? ' · compressing…' : ''}</label>
            <input className="form-input" type="file" accept="image/*" multiple onChange={handlePhotos} disabled={uploading} />
            {form.photos.length > 0 && (
              <div className="inv-add-item-photos">
                {form.photos.map((src, i) => (
                  <div key={i} className="inv-add-item-photo">
                    <img src={src} alt="" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      aria-label="Remove photo"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="form-group form-group-full">
            <label className="form-label">Notes</label>
            <textarea className="form-input" value={form.notes} onChange={set('notes')} rows={2} />
          </div>
        </div>
      </form>
    </ModalShell>
  );
}
