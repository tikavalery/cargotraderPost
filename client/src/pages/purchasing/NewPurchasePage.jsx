import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '../../layout/AppShell';
import PurchaseForm from '../../components/purchasing/PurchaseForm';
import AddEditSupplierModal from '../../components/purchasing/AddEditSupplierModal';
import { useSuppliers } from '../../hooks/useSuppliers';
import { useGroupedLocations } from '../../hooks/useLocations';
import { usePurchase } from '../../hooks/usePurchase';
import { useToast } from '../../context/ToastContext';
import { purchasesApi, suppliersApi } from '../../api';
import { resolvePhotosForSave } from '../../utils/cloudinaryUpload';
import { useInventoryMeta } from '../../hooks/useInventory';
import { buildPurchaseNotes } from '../../utils/purchaseAi';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM = {
  itemName: '',
  sku: '',
  category: 'Clothes',
  group: '',
  condition: '',
  quantity: 1,
  location: '',
  purchasePrice: '',
  targetPrice: '',
  photos: [],
  supplierId: '',
  purchaseDate: todayISO(),
  notes: ''
};

export default function NewPurchasePage() {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const navigate = useNavigate();
  const { showToast } = useToast();
  const formRef = useRef(null);

  const { suppliers, refresh: refreshSuppliers } = useSuppliers();
  const { purchase, loading: loadingPurchase } = usePurchase(editId);
  const [form, setForm] = useState(EMPTY_FORM);
  const { groups, defaultLocation } = useGroupedLocations(form.location);
  const { groups: itemGroups } = useInventoryMeta();
  const [saving, setSaving] = useState(false);
  const [addSupplierOpen, setAddSupplierOpen] = useState(false);
  const [supplierSaving, setSupplierSaving] = useState(false);

  useEffect(() => {
    if (defaultLocation && !form.location && !editId) {
      setForm((f) => ({ ...f, location: defaultLocation }));
    }
  }, [defaultLocation, editId, form.location]);

  useEffect(() => {
    if (!purchase) return;
    setForm({
      itemName: purchase.itemName || '',
      sku: purchase.sku || '',
      category: purchase.category || 'Clothes',
      group: purchase.group || '',
      condition: purchase.condition || '',
      quantity: purchase.quantity ?? 1,
      location: purchase.location || defaultLocation || '',
      purchasePrice: purchase.purchasePrice ?? '',
      targetPrice: purchase.targetPrice ?? '',
      photos: purchase.photos || [],
      supplierId: purchase.supplier?.supplierId || purchase.supplierId || '',
      purchaseDate: purchase.purchaseDate
        ? new Date(purchase.purchaseDate).toISOString().slice(0, 10)
        : todayISO(),
      notes: purchase.notes || ''
    });
    setTimeout(() => {
      document.getElementById('purchase-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, [purchase, defaultLocation]);

  const validateSaved = () => {
    if (!form.itemName.trim()) {
      showToast('Item name is required');
      return false;
    }
    if (!form.quantity || Number(form.quantity) <= 0) {
      showToast('Quantity is required');
      return false;
    }
    if (!form.purchasePrice) {
      showToast('Purchase price is required');
      return false;
    }
    if (!form.targetPrice) {
      showToast('Target price is required');
      return false;
    }
    if (!form.supplierId) {
      showToast('Please select a supplier');
      return false;
    }
    if (!form.purchaseDate) {
      showToast('Purchase date is required');
      return false;
    }
    return true;
  };

  const buildPayload = (status) => {
    const payload = {
      status,
      itemName: form.itemName.trim(),
      sku: form.sku.trim(),
      category: form.category,
      group: form.group.trim() || null,
      location: form.location,
      purchasePrice: Number(form.purchasePrice) || 0,
      targetPrice: Number(form.targetPrice) || 0,
      supplierId: form.supplierId,
      purchaseDate: form.purchaseDate,
      notes: buildPurchaseNotes(form.notes, form.condition),
      photos: form.photos,
      quantity: Number(form.quantity) || 0
    };
    return payload;
  };

  const handleSave = async (status) => {
    if (status === 'saved' && !validateSaved()) return;
    setSaving(true);
    try {
      let photos = form.photos;
      try {
        photos = await resolvePhotosForSave(photos);
      } catch (upErr) {
        showToast(upErr.response?.data?.message || 'Photo upload to Cloudinary failed');
        return;
      }

      const payload = { ...buildPayload(status), photos };
      const isEdit = Boolean(editId && purchase);
      if (isEdit) {
        await purchasesApi.update(editId, payload);
        showToast(status === 'saved' ? 'Purchase updated' : 'Draft updated', 'success');
        // Refresh inventory + finance consumers after any save that can change qty/cost
        window.dispatchEvent(new CustomEvent('afritrade:inventory-changed'));
        navigate('/purchasing/all', { replace: true });
        return;
      }

      await purchasesApi.create(payload);
      showToast(status === 'saved' ? 'Purchase saved — added to inventory' : 'Saved as draft', 'success');
      // Refresh inventory + finance consumers after any save that can change qty/cost
      window.dispatchEvent(new CustomEvent('afritrade:inventory-changed'));
      navigate('/purchasing/all', { replace: true });
    } catch (e) {
      const message =
        e.response?.status === 413
          ? 'Purchase photos are too large to save. Use fewer photos or smaller images.'
          : e.code === 'ERR_NETWORK'
            ? 'Could not reach the server while saving this purchase'
            : e.response?.data?.message || e.message || 'Failed to save purchase';
      showToast(message);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    if (!window.confirm('Clear form?')) return;
    setForm({ ...EMPTY_FORM, location: defaultLocation || '', purchaseDate: todayISO() });
    if (editId) navigate('/purchasing/new', { replace: true });
  };

  const handleAddSupplier = async (data) => {
    setSupplierSaving(true);
    try {
      const res = await suppliersApi.create(data);
      const created = res.data.data;
      await refreshSuppliers();
      setForm((f) => ({ ...f, supplierId: created.supplierId }));
      setAddSupplierOpen(false);
      showToast(`Supplier added: ${created.name}`, 'success');
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to add supplier');
    } finally {
      setSupplierSaving(false);
    }
  };

  return (
    <AppShell className="app-shell--new-purchase" navbarTitle="New Purchase" hideSearch>
      <div className="content pur-new-page" ref={formRef}>
        <div className="page-header pur-new-chrome">
          <div>
            <h1>New Purchase</h1>
            <p className="page-sub">
              Record new stock purchases — saved records flow into Individual Items inventory
            </p>
          </div>
        </div>

        {loadingPurchase && editId ? (
          <p className="page-sub">Loading purchase…</p>
        ) : (
          <PurchaseForm
            form={form}
            setForm={setForm}
            groups={groups}
            itemGroups={itemGroups}
            suppliers={suppliers}
            editing={Boolean(editId)}
            saving={saving}
            onSave={handleSave}
            onClear={handleClear}
            onAddSupplier={() => setAddSupplierOpen(true)}
          />
        )}
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
