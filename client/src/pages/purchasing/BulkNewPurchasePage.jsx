import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../layout/AppShell';
import BulkPurchaseReceiptSection from '../../components/purchasing/BulkPurchaseReceiptSection';
import BulkItemPhotosSection from '../../components/purchasing/BulkItemPhotosSection';
import SupplierSelect from '../../components/purchasing/SupplierSelect';
import AddEditSupplierModal from '../../components/purchasing/AddEditSupplierModal';
import { CategorySelectOptions } from '../../components/inventory/CategorySelectOptions';
import { useSuppliers } from '../../hooks/useSuppliers';
import { useGroupedLocations } from '../../hooks/useLocations';
import { useToast } from '../../context/ToastContext';
import { purchasesApi, suppliersApi } from '../../api';
import { resolvePhotosForSave } from '../../utils/cloudinaryUpload';
import { emitInventoryChanged } from '../../utils/inventoryEvents';
import { useT } from '../../i18n/LanguageContext';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function emptyLine() {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    itemName: '',
    category: 'Clothes',
    quantity: 1,
    purchasePrice: '',
    targetPrice: '',
    condition: '',
    notes: ''
  };
}

function lineFromAi(item) {
  return {
    ...emptyLine(),
    itemName: item.itemName || '',
    category: item.category || 'Clothes',
    quantity: Math.max(1, Number(item.quantity) || 1),
    purchasePrice: item.estimatedPurchasePrice != null ? String(item.estimatedPurchasePrice) : '',
    targetPrice: item.suggestedTargetPrice != null ? String(item.suggestedTargetPrice) : '',
    condition: item.condition || '',
    notes: item.suggestedDescription || ''
  };
}

export default function BulkNewPurchasePage() {
  const t = useT();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { suppliers, refresh: refreshSuppliers } = useSuppliers();
  const { groups } = useGroupedLocations('');

  const [receiptPhotos, setReceiptPhotos] = useState([]);
  const [itemPhotos, setItemPhotos] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayISO());
  const [location, setLocation] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [addSupplierOpen, setAddSupplierOpen] = useState(false);
  const [supplierSaving, setSupplierSaving] = useState(false);

  const totals = useMemo(() => {
    let units = 0;
    let cost = 0;
    for (const line of lines) {
      const qty = Math.max(0, Number(line.quantity) || 0);
      const price = Math.max(0, Number(line.purchasePrice) || 0);
      units += qty;
      cost += qty * price;
    }
    return { rows: lines.length, units, cost };
  }, [lines]);

  const photosByLine = useMemo(() => {
    const map = {};
    for (const photo of itemPhotos) {
      if (!photo.lineKey) continue;
      if (!map[photo.lineKey]) map[photo.lineKey] = [];
      map[photo.lineKey].push(photo);
    }
    return map;
  }, [itemPhotos]);

  const updateLine = (key, patch) => {
    setLines((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const removeLine = (key) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.key !== key)));
    setItemPhotos((prev) =>
      prev.map((p) => (p.lineKey === key ? { ...p, lineKey: '', confidence: 0 } : p))
    );
  };

  const handleAiApply = (data) => {
    const items = Array.isArray(data?.items) ? data.items : [];
    if (items.length) {
      setLines(items.map(lineFromAi));
      // New line keys — clear previous photo assignments
      setItemPhotos((prev) =>
        prev.map((p) => ({ ...p, lineKey: '', confidence: 0, identifiedAs: p.identifiedAs || '' }))
      );
    }
    if (data?.purchaseDateHint && /^\d{4}-\d{2}-\d{2}$/.test(data.purchaseDateHint)) {
      setPurchaseDate(data.purchaseDateHint);
    }
    if (data?.supplierNameHint && !supplierId) {
      const hint = String(data.supplierNameHint).trim().toLowerCase();
      const match = suppliers.find((s) => String(s.name || '').trim().toLowerCase() === hint);
      if (match) setSupplierId(match.supplierId);
    }
  };

  const validate = () => {
    if (!supplierId) {
      showToast('Select a supplier');
      return false;
    }
    if (!purchaseDate) {
      showToast('Purchase date is required');
      return false;
    }
    if (!lines.length) {
      showToast('Add at least one line');
      return false;
    }
    for (let i = 0; i < lines.length; i += 1) {
      const row = lines[i];
      if (!String(row.itemName || '').trim()) {
        showToast(`Line ${i + 1}: item name is required`);
        return false;
      }
      if (!(Number(row.quantity) > 0)) {
        showToast(`Line ${i + 1}: quantity must be greater than 0`);
        return false;
      }
      if (!(Number(row.purchasePrice) > 0)) {
        showToast(`Line ${i + 1}: purchase price is required`);
        return false;
      }
      if (!(Number(row.targetPrice) > 0)) {
        showToast(`Line ${i + 1}: target price is required`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const itemsPayload = [];
      for (const row of lines) {
        const matched = photosByLine[row.key] || [];
        let readyPhotos = matched.map((p) => p.src);
        if (readyPhotos.length) {
          try {
            readyPhotos = await resolvePhotosForSave(readyPhotos);
          } catch (upErr) {
            showToast(upErr.response?.data?.message || `Photo upload failed for ${row.itemName}`);
            return;
          }
        }
        itemsPayload.push({
          itemName: String(row.itemName).trim(),
          category: row.category || 'Clothes',
          quantity: Number(row.quantity) || 1,
          purchasePrice: Number(row.purchasePrice) || 0,
          targetPrice: Number(row.targetPrice) || 0,
          notes: [row.condition, row.notes].filter(Boolean).join(' · ').slice(0, 500),
          photos: readyPhotos
        });
      }

      const res = await purchasesApi.bulkCreate({
        supplierId,
        purchaseDate,
        location: location || '',
        items: itemsPayload
      });

      const created = res.data?.created ?? res.data?.data?.length ?? 0;
      const failed = res.data?.failed || 0;
      emitInventoryChanged();
      showToast(
        failed
          ? `Saved ${created} purchase(s); ${failed} failed`
          : `Saved ${created} purchase(s) to inventory`,
        'success'
      );
      navigate('/purchasing/all');
    } catch (e) {
      showToast(e.response?.data?.message || e.message || 'Bulk purchase failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSupplier = async (data) => {
    setSupplierSaving(true);
    try {
      const res = await suppliersApi.create(data);
      const created = res.data?.data || res.data;
      await refreshSuppliers();
      if (created?.supplierId) setSupplierId(created.supplierId);
      setAddSupplierOpen(false);
      showToast('Supplier added', 'success');
    } catch (e) {
      showToast(e.response?.data?.message || 'Could not add supplier');
    } finally {
      setSupplierSaving(false);
    }
  };

  return (
    <AppShell
      className="app-shell--new-purchase"
      breadcrumbs={[
        { label: 'CargoTrader', to: '/dashboard' },
        { label: 'Buying / Purchases', to: '/purchasing/all' },
        { label: 'Bulk New Purchase', current: true }
      ]}
    >
      <div className="content pur-new-page pur-bulk-page">
        <div className="page-header pur-new-chrome">
          <div>
            <h1 className="page-title">
              <i className="fas fa-layer-group" /> {t('Bulk New Purchase')}
            </h1>
            <p className="page-sub">
              {t(
                'Scan a receipt, photograph each item — AI matches photos to lines, then save to inventory'
              )}
            </p>
          </div>
        </div>

        <div className="form-card" id="bulk-purchase-form-card">
          <div className="form-card-header">
            <div className="form-card-title">
              <i className="fas fa-receipt" /> 1. Receipt & shared details
            </div>
          </div>
          <div className="form-card-body">
            <BulkPurchaseReceiptSection
              photos={receiptPhotos}
              onPhotosChange={setReceiptPhotos}
              onAnalysisApply={handleAiApply}
            />

            <div className="form-grid-2" style={{ marginTop: 12 }}>
              <SupplierSelect
                suppliers={suppliers}
                value={supplierId}
                onChange={setSupplierId}
                onAddSupplier={() => setAddSupplierOpen(true)}
              />
              <div className="form-group">
                <label className="form-label">
                  Purchase Date <span className="req">*</span>
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Location (all lines)</label>
                <select
                  className="form-select"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                >
                  <option value="">No location — assign later</option>
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
                <p className="form-hint" style={{ marginTop: 6, fontSize: 11, color: 'var(--text-light)' }}>
                  Every item in this batch uses the same location. Leave empty to place stock later.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="form-card" style={{ marginTop: 14 }}>
          <div className="form-card-header">
            <div className="form-card-title">
              <i className="fas fa-list" /> 2. Line items
            </div>
            <button type="button" className="btn-ghost" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
              <i className="fas fa-plus" /> Add line
            </button>
          </div>
          <div className="form-card-body">
            <div className="pur-bulk-lines-wrap">
              <table className="pur-bulk-lines-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Photo</th>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Qty</th>
                    <th>Cost (XAF)</th>
                    <th>Target (XAF)</th>
                    <th>Notes</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((row, idx) => {
                    const matched = photosByLine[row.key] || [];
                    const thumb = matched[0]?.src;
                    return (
                      <tr key={row.key}>
                        <td data-label="#">{idx + 1}</td>
                        <td data-label="Photo" className="pur-bulk-line-photo-cell">
                          {thumb ? (
                            <img src={thumb} alt="" className="pur-bulk-line-thumb" />
                          ) : (
                            <span className="pur-bulk-line-thumb-empty" title="No matched photo">
                              <i className="fas fa-image" />
                            </span>
                          )}
                        </td>
                        <td data-label="Item">
                          <input
                            className="form-input"
                            value={row.itemName}
                            onChange={(e) => updateLine(row.key, { itemName: e.target.value })}
                            placeholder="Item name"
                          />
                        </td>
                        <td data-label="Category">
                          <select
                            className="form-select"
                            value={row.category}
                            onChange={(e) => updateLine(row.key, { category: e.target.value })}
                          >
                            <CategorySelectOptions />
                          </select>
                        </td>
                        <td data-label="Qty">
                          <input
                            className="form-input"
                            type="number"
                            min="1"
                            value={row.quantity}
                            onChange={(e) => updateLine(row.key, { quantity: e.target.value })}
                          />
                        </td>
                        <td data-label="Cost">
                          <input
                            className="form-input"
                            type="number"
                            min="0"
                            value={row.purchasePrice}
                            onChange={(e) => updateLine(row.key, { purchasePrice: e.target.value })}
                          />
                        </td>
                        <td data-label="Target">
                          <input
                            className="form-input"
                            type="number"
                            min="0"
                            value={row.targetPrice}
                            onChange={(e) => updateLine(row.key, { targetPrice: e.target.value })}
                          />
                        </td>
                        <td data-label="Notes">
                          <input
                            className="form-input"
                            value={row.notes}
                            onChange={(e) => updateLine(row.key, { notes: e.target.value })}
                            placeholder="Optional"
                          />
                        </td>
                        <td data-label="">
                          <button
                            type="button"
                            className="link-btn"
                            onClick={() => removeLine(row.key)}
                            disabled={lines.length <= 1}
                            aria-label="Remove line"
                          >
                            <i className="fas fa-trash" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="form-card" style={{ marginTop: 14 }}>
          <div className="form-card-header">
            <div className="form-card-title">
              <i className="fas fa-images" /> 3. Match product photos
            </div>
          </div>
          <div className="form-card-body">
            <BulkItemPhotosSection
              photos={itemPhotos}
              onPhotosChange={setItemPhotos}
              lines={lines}
            />

            <div className="pur-bulk-summary">
              <span>
                {totals.rows} line{totals.rows === 1 ? '' : 's'}
              </span>
              <span>{totals.units} unit{totals.units === 1 ? '' : 's'}</span>
              <span>Est. cost {totals.cost.toLocaleString('en-US')} XAF</span>
              <span>
                {itemPhotos.filter((p) => p.lineKey).length}/{itemPhotos.length || 0} photos matched
              </span>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={() => navigate('/purchasing/all')} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="btn-save" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Saving…' : `Save ${lines.length} to inventory`}
              </button>
            </div>
          </div>
        </div>
      </div>

      <AddEditSupplierModal
        open={addSupplierOpen}
        onClose={() => setAddSupplierOpen(false)}
        onSave={handleAddSupplier}
        saving={supplierSaving}
      />
    </AppShell>
  );
}
