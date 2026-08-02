import { useEffect, useMemo, useState } from 'react';
import ModalPortal from '../common/ModalPortal';
import { shippingApi } from '../../services/shippingApi';
import { useWarehouses } from '../../hooks/useWarehouses';

const METHODS = [
  { id: 'ocean', label: 'Ocean Freight', icon: 'fa-ship' },
  { id: 'air', label: 'Air Freight', icon: 'fa-plane' },
  { id: 'traveler', label: 'Traveler Carry', icon: 'fa-suitcase' }
];

const FLAG_MAP = { China: '🇨🇳', Turkey: '🇹🇷', UAE: '🇦🇪', USA: '🇺🇸', France: '🇫🇷', Cameroon: '🇨🇲', Nigeria: '🇳🇬' };

const STATUSES = [
  'Pending',
  'In Transit',
  'Delayed',
  'Arrived',
  'At Customs',
  'Delivered',
  'Closed',
  'Offloaded',
  'Cancelled'
];

const EMPTY_FORM = {
  shipmentId: '',
  origin: 'Guangzhou',
  originCountry: 'China',
  dest: 'Douala',
  destCountry: 'Cameroon',
  shippingMethod: 'ocean',
  carrier: '',
  container: '',
  eta: '',
  items: 0,
  weight: '',
  goodsValue: 4800,
  freight: 2000,
  status: 'In Transit',
  warehouseId: '',
  warehouseName: ''
};

function toDateInput(eta) {
  if (!eta) return '';
  const d = new Date(eta);
  if (Number.isNaN(d.getTime())) return String(eta).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function shipmentToForm(shipment) {
  if (!shipment) return { ...EMPTY_FORM };
  const goodsValue = shipment.goodsCost
    ? Math.round(shipment.goodsCost / 600)
    : Math.round((shipment.landedCostUsd || 0) * 0.6);
  const freight = shipment.shippingCost ? Math.round(shipment.shippingCost / 600) : 0;
  return {
    shipmentId: shipment.shipmentId || shipment.id || '',
    origin: shipment.origin || '',
    originCountry: shipment.originCountry || 'China',
    dest: shipment.dest || '',
    destCountry: shipment.destCountry || 'Cameroon',
    shippingMethod: shipment.shippingMethod || 'ocean',
    carrier: shipment.carrier || '',
    container: shipment.container || shipment.trackingNumber || '',
    eta: toDateInput(shipment.etaRaw || shipment.eta),
    items: shipment.items ?? 0,
    weight: shipment.weight === '—' ? '' : shipment.weight || '',
    goodsValue,
    freight,
    status: shipment.status || 'In Transit',
    warehouseId: shipment.warehouseId || '',
    warehouseName: shipment.warehouseName || ''
  };
}

export default function NewShipmentModal({
  open,
  shipment,
  onClose,
  onCreated,
  onUpdated,
  showToast
}) {
  const isEdit = Boolean(shipment);
  const { warehouses } = useWarehouses();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setForm(shipmentToForm(shipment));
    } else {
      setForm({ ...EMPTY_FORM });
      shippingApi.nextId().then((res) => {
        setForm((f) => ({ ...f, shipmentId: res.data?.shipmentId || '' }));
      }).catch(() => {});
    }
    // Only re-init when opening or switching which shipment is edited — not on parent re-renders.
  }, [open, isEdit, shipment?.shipmentId, shipment?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const preview = useMemo(() => {
    const goods = Number(form.goodsValue) || 0;
    const freight = Number(form.freight) || 0;
    const insurance = goods * 0.02;
    const duty = (goods + freight) * 0.18;
    const vat = (goods + freight + insurance + duty) * 0.1925;
    // Clearing estimate only when there is cargo value (empty shipments stay $0)
    const clearing = goods + freight > 0 ? 350 : 0;
    return Math.round(goods + freight + insurance + duty + vat + clearing);
  }, [form.goodsValue, form.freight]);

  const isCompletedStatus = ['Delivered', 'Closed', 'Offloaded'].includes(form.status);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleWarehousePick = (warehouseId) => {
    const wh = warehouses.find((w) => w.id === warehouseId);
    setForm((f) => ({
      ...f,
      warehouseId: warehouseId || '',
      warehouseName: wh?.name || ''
    }));
  };

  const buildPayload = () => ({
    shipmentId: form.shipmentId || undefined,
    origin: form.origin,
    originFlag: FLAG_MAP[form.originCountry] || '🇨🇳',
    originCountry: form.originCountry,
    dest: form.dest,
    destFlag: FLAG_MAP[form.destCountry] || '🇨🇲',
    destCountry: form.destCountry,
    shippingMethod: form.shippingMethod,
    carrier: form.carrier || 'TBD',
    container: form.container,
    trackingNumber: form.container,
    eta: form.eta,
    items: Number(form.items) || 0,
    weight: form.weight,
    goodsCostUsd: Number(form.goodsValue),
    freightCostUsd: Number(form.freight),
    landedCostUsd: preview,
    status: form.status,
    warehouseId: form.warehouseId,
    warehouseName: form.warehouseName
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        const id = shipment.shipmentId || shipment.id;
        const res = await shippingApi.update(id, buildPayload());
        showToast?.('Shipment updated', 'success');
        onUpdated?.(res.data.data);
      } else {
        const res = await shippingApi.create(buildPayload());
        showToast?.('Shipment created', 'success');
        onCreated?.(res.data.data);
      }
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || `Failed to ${isEdit ? 'update' : 'create'} shipment`;
      showToast?.(msg);
      if (!isEdit && err.response?.status === 409) {
        shippingApi.nextId().then((res) => {
          setForm((f) => ({ ...f, shipmentId: res.data?.shipmentId || '' }));
        }).catch(() => {});
      }
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const closeFromBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <ModalPortal>
      <div
        className="ship-modal-overlay"
        onMouseDown={closeFromBackdrop}
        role="presentation"
      >
        <div
          className="ship-modal ship-modal-lg"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ship-modal-title"
        >
          <div className="ship-modal-header">
            <div className="ship-modal-header-text">
              <div className="ship-modal-title" id="ship-modal-title">
                {isEdit ? 'Edit Shipment' : 'Create New Shipment'}
              </div>
              <div className="ship-modal-sub">
                {isEdit
                  ? 'Update freight details, status, and delivery information'
                  : 'Register international freight for tracking'}
              </div>
            </div>
            <button type="button" className="ship-modal-close" onClick={onClose} aria-label="Close">
              <i className="fas fa-times" />
            </button>
          </div>
          <form className="ship-modal-form" onSubmit={handleSubmit}>
            <div className="ship-modal-body">
              <label className="form-label" htmlFor="ship-form-id">Shipment ID</label>
              <input id="ship-form-id" className="form-input" value={form.shipmentId} readOnly />

              <div className="form-grid-2">
                <div>
                  <label className="form-label" htmlFor="ship-form-origin">Origin City</label>
                  <input id="ship-form-origin" className="form-input" value={form.origin} onChange={set('origin')} required />
                </div>
                <div>
                  <label className="form-label" htmlFor="ship-form-origin-country">Origin Country</label>
                  <input
                    id="ship-form-origin-country"
                    className="form-input"
                    value={form.originCountry}
                    onChange={set('originCountry')}
                    placeholder="e.g. China"
                    required
                  />
                </div>
              </div>
              <div className="form-grid-2">
                <div>
                  <label className="form-label" htmlFor="ship-form-dest">Destination City</label>
                  <input id="ship-form-dest" className="form-input" value={form.dest} onChange={set('dest')} required />
                </div>
                <div>
                  <label className="form-label" htmlFor="ship-form-dest-country">Destination Country</label>
                  <input
                    id="ship-form-dest-country"
                    className="form-input"
                    value={form.destCountry}
                    onChange={set('destCountry')}
                    placeholder="e.g. Cameroon"
                    required
                  />
                </div>
              </div>

              {isEdit && (
                <div className="form-grid-2">
                  <div>
                    <label className="form-label" htmlFor="ship-form-status">Status</label>
                    <select id="ship-form-status" className="form-input" value={form.status} onChange={set('status')}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label" htmlFor="ship-form-weight">Cargo Weight</label>
                    <input id="ship-form-weight" className="form-input" placeholder="e.g. 2.4 MT" value={form.weight} onChange={set('weight')} />
                  </div>
                </div>
              )}

              <label className="form-label">Shipping Method</label>
              <div className="method-chips" role="group" aria-label="Shipping method">
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`method-chip${form.shippingMethod === m.id ? ' active' : ''}`}
                    onClick={() => setForm((f) => ({ ...f, shippingMethod: m.id }))}
                  >
                    <i className={`fas ${m.icon}`} /> {m.label}
                  </button>
                ))}
              </div>
              <div className="form-grid-2">
                <div>
                  <label className="form-label" htmlFor="ship-form-carrier">Carrier</label>
                  <input id="ship-form-carrier" className="form-input" placeholder="COSCO, MSC…" value={form.carrier} onChange={set('carrier')} />
                </div>
                <div>
                  <label className="form-label" htmlFor="ship-form-tracking">Container / Tracking</label>
                  <input id="ship-form-tracking" className="form-input" value={form.container} onChange={set('container')} />
                </div>
              </div>
              <div className="form-grid-2">
                <div>
                  <label className="form-label" htmlFor="ship-form-eta">
                    {isCompletedStatus ? 'Delivered / Arrival Date' : 'Expected ETA'}
                  </label>
                  <input id="ship-form-eta" type="date" className="form-input" value={form.eta} onChange={set('eta')} />
                </div>
                <div>
                  <label className="form-label" htmlFor="ship-form-items">Item Count</label>
                  <input id="ship-form-items" type="number" className="form-input" value={form.items} onChange={set('items')} min={0} />
                  {isEdit && (
                    <p className="form-hint" style={{ marginTop: 4 }}>
                      Linked inventory items may override this count automatically.
                    </p>
                  )}
                </div>
              </div>

              {isEdit && isCompletedStatus && (
                <div>
                  <label className="form-label" htmlFor="ship-form-warehouse">Offload Warehouse</label>
                  <select
                    id="ship-form-warehouse"
                    className="form-input"
                    value={form.warehouseId}
                    onChange={(e) => handleWarehousePick(e.target.value)}
                  >
                    <option value="">— Select warehouse —</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.flag} {w.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-grid-2">
                <div>
                  <label className="form-label" htmlFor="ship-form-goods">Goods Value (USD)</label>
                  <input id="ship-form-goods" type="number" className="form-input" value={form.goodsValue} onChange={set('goodsValue')} />
                </div>
                <div>
                  <label className="form-label" htmlFor="ship-form-freight">Freight (USD)</label>
                  <input id="ship-form-freight" type="number" className="form-input" value={form.freight} onChange={set('freight')} />
                </div>
              </div>
              <div className="calc-result-box">
                <div className="calc-result-label">Estimated Landed Cost</div>
                <div className="calc-result-value">${Number(preview).toLocaleString('en-US')}</div>
              </div>
            </div>
            <div className="ship-modal-footer">
              <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary-green" disabled={saving}>
                <i className={`fas ${isEdit ? 'fa-save' : 'fa-check'}`} />
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Shipment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
