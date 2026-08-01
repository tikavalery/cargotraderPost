import { useEffect, useMemo, useState } from 'react';
import ModalPortal from '../common/ModalPortal';

function rowId(row) {
  const raw = row?._id ?? row?.id ?? row?.selectId ?? '';
  if (raw && typeof raw === 'object' && raw.toString) return String(raw.toString());
  return String(raw || '').trim();
}

function rowKey(row) {
  return rowId(row) || String(row?.sku || '');
}

function defaultQtyMap(items = []) {
  const map = {};
  for (const row of items) {
    const key = rowKey(row);
    if (!key) continue;
    map[key] = Math.max(1, Number(row.qty) || 1);
  }
  return map;
}

export default function TransferModal({
  open,
  fromWarehouse,
  fromSource,
  selectedItems,
  allWarehouses,
  allStores = [],
  activeShipments = [],
  defaultDestType = 'warehouse',
  defaultDestId = '',
  onClose,
  onConfirm,
  saving
}) {
  const [destType, setDestType] = useState('warehouse');
  const [destId, setDestId] = useState('');
  const [notes, setNotes] = useState('');
  const [qtyById, setQtyById] = useState({});
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    const isStoreSource = fromSource?.type === 'store';
    let type = 'warehouse';
    if (!isStoreSource && defaultDestType === 'store') type = 'store';
    else if (defaultDestType === 'shipment') type = 'shipment';
    setDestType(type);
    setDestId(defaultDestId || '');
    setNotes('');
    setQtyById(defaultQtyMap(selectedItems));
    setSuccess(false);
    setSuccessMessage('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDestType, defaultDestId, fromSource, fromWarehouse]);

  // Keep qty map in sync if selection arrives slightly after open
  useEffect(() => {
    if (!open || !selectedItems?.length) return;
    setQtyById((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const row of selectedItems) {
        const key = rowKey(row);
        if (!key) continue;
        if (next[key] == null || next[key] === '') {
          next[key] = Math.max(1, Number(row.qty) || 1);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [open, selectedItems]);

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

  const transferLines = useMemo(() => {
    return (selectedItems || []).map((row) => {
      const key = rowKey(row);
      const available = Math.max(1, Number(row.qty) || 1);
      const raw = Number(qtyById[key]);
      const qty = Number.isFinite(raw) ? Math.min(available, Math.max(1, Math.floor(raw))) : available;
      return { row, key, available, qty };
    });
  }, [selectedItems, qtyById]);

  const totalUnits = transferLines.reduce((sum, line) => sum + line.qty, 0);
  const qtyValid = transferLines.every((line) => line.qty >= 1 && line.qty <= line.available);

  if (!open) return null;

  const source =
    fromSource ||
    (fromWarehouse
      ? { type: 'warehouse', id: fromWarehouse.id, name: fromWarehouse.name, flag: fromWarehouse.flag }
      : null);
  if (!source) return null;

  const fromStore = source.type === 'store';
  const warehouseDestinations =
    source.type === 'warehouse'
      ? (allWarehouses || []).filter((w) => w.id !== source.id)
      : allWarehouses || [];
  const storeDestinations = (allStores || []).filter((s) => {
    if (s.active === false) return false;
    if (fromStore) return String(s.storeId) !== String(source.storeId || source.id);
    return true;
  });
  const sourceShipmentId = source.type === 'shipment' ? source.shipmentId || source.id : '';
  const shipmentDestinations = (activeShipments || []).filter((s) => {
    if (s.mode === 'completed') return false;
    const sid = s.shipmentId || s.id;
    return !sourceShipmentId || sid !== sourceShipmentId;
  });
  const hasSelection = selectedItems.length > 0;
  const fromLabel =
    source.type === 'store'
      ? `${source.flag || source.icon || '🏪'} ${source.name}`
      : source.type === 'shipment'
        ? `${source.originFlag || '🚢'} ${source.name || source.shipmentId || source.id}`
        : `${source.flag || ''} ${source.name}`.trim();

  const modalSubtitle = fromStore
    ? 'Move selected shelf stock to another store, return to a warehouse, or load onto a shipment'
    : 'Move selected items to a warehouse, store, or active shipment — set qty to transfer part of a product';

  const setLineQty = (key, available, value) => {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) {
      setQtyById((prev) => ({ ...prev, [key]: '' }));
      return;
    }
    setQtyById((prev) => ({
      ...prev,
      [key]: Math.min(available, Math.max(1, n))
    }));
  };

  const handleConfirm = async () => {
    const items = transferLines
      .map(({ row, qty }) => {
        const itemId = rowId(row);
        return itemId ? { itemId, qty } : null;
      })
      .filter(Boolean);
    if (!items.length) return;
    try {
      const res = await onConfirm({
        toDestinationId: destId,
        destinationType: destType,
        notes,
        items,
        itemIds: items.map((i) => i.itemId)
      });
      setSuccessMessage(
        typeof res === 'string'
          ? res
          : destType === 'shipment'
            ? fromStore
              ? 'Stock loaded onto shipment'
              : 'Items loaded onto shipment'
            : destType === 'store'
              ? fromStore
                ? 'Stock moved to store'
                : 'Stock sent to store'
              : fromStore
                ? 'Stock returned to warehouse'
                : 'Transfer completed successfully!'
      );
      setSuccess(true);
      setTimeout(() => onClose(), 1200);
    } catch {
      /* toast handled by caller */
    }
  };

  const switchDestType = (type) => {
    setDestType(type);
    setDestId('');
  };

  return (
    <ModalPortal>
      <div
        className="wh-modal-overlay open transfer-modal-overlay"
        id="transferModal"
        onClick={onClose}
        role="presentation"
      >
        <div
          className="wh-modal wh-modal-lg transfer-modal"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="transfer-modal-title"
        >
          <div className="wh-modal-header">
            <div className="wh-modal-header-text">
              <div className="wh-modal-title" id="transfer-modal-title">Transfer Stock</div>
              <div className="wh-modal-sub">{modalSubtitle}</div>
            </div>
            <button type="button" className="wh-modal-close" onClick={onClose} aria-label="Close">
              <i className="fas fa-times" />
            </button>
          </div>
          <div className="wh-modal-body">
            <div className="transfer-from">
              <strong>From:</strong> {fromLabel}
            </div>
            <div className="transfer-summary-strip">
              <span>{selectedItems.length} product{selectedItems.length !== 1 ? 's' : ''}</span>
              <span>{totalUnits} unit{totalUnits !== 1 ? 's' : ''} to move</span>
            </div>
            {!hasSelection && (
              <p className="transfer-hint-warn">
                <i className="fas fa-info-circle" /> Select items before transferring.
              </p>
            )}
            {hasSelection && (
              <div className="transfer-items-box">
                {transferLines.map(({ row, key, available, qty }) => (
                  <div key={key} className="transfer-item">
                    <div
                      className="item-photo"
                      style={{
                        background: `${row.color || '#1A3C5E'}22`,
                        color: row.color,
                        width: 36,
                        height: 36,
                        fontSize: 14
                      }}
                    >
                      <i className={`fas ${row.icon || 'fa-box'}`} />
                    </div>
                    <div className="transfer-item-meta">
                      <div className="item-name">{row.name}</div>
                      <div className="sku-code">{row.sku} · {available} available</div>
                    </div>
                    <div className="transfer-qty-field">
                      <label htmlFor={`xfer-qty-${key}`}>Qty</label>
                      <input
                        id={`xfer-qty-${key}`}
                        type="number"
                        className="transfer-qty-input"
                        min={1}
                        max={available}
                        value={qtyById[key] ?? qty}
                        onChange={(e) => setLineQty(key, available, e.target.value)}
                        aria-label={`Quantity to transfer for ${row.name}`}
                      />
                      <button
                        type="button"
                        className="transfer-qty-all"
                        onClick={() => setLineQty(key, available, available)}
                        title="Transfer all"
                      >
                        All
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <label className="form-label" htmlFor="transfer-notes" style={{ marginTop: 14 }}>
              Notes (optional)
            </label>
            <input
              id="transfer-notes"
              className="form-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            <label className="form-label" style={{ marginTop: 14 }}>
              Choose Destination
            </label>
            <div className="transfer-dest-tabs" role="tablist" aria-label="Destination type">
              <button
                type="button"
                className={`transfer-dest-tab${destType === 'warehouse' ? ' active' : ''}`}
                onClick={() => switchDestType('warehouse')}
              >
                <i className="fas fa-warehouse" /> Warehouse
              </button>
              {!fromStore && (
                <button
                  type="button"
                  className={`transfer-dest-tab${destType === 'store' ? ' active' : ''}`}
                  onClick={() => switchDestType('store')}
                >
                  <i className="fas fa-store" /> Store
                </button>
              )}
              {fromStore && (
                <button
                  type="button"
                  className={`transfer-dest-tab${destType === 'store' ? ' active' : ''}`}
                  onClick={() => switchDestType('store')}
                  disabled={storeDestinations.length === 0}
                >
                  <i className="fas fa-store" /> Another Store
                </button>
              )}
              <button
                type="button"
                className={`transfer-dest-tab${destType === 'shipment' ? ' active' : ''}`}
                onClick={() => switchDestType('shipment')}
                disabled={source.type === 'shipment' && shipmentDestinations.length === 0}
              >
                <i className="fas fa-ship" /> Shipping
              </button>
            </div>

            {destType === 'warehouse' && (
              <div className="dest-warehouse-grid">
                {warehouseDestinations.length === 0 ? (
                  <div className="xfer-empty-dest">No other warehouses available</div>
                ) : (
                  warehouseDestinations.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      className={`dest-wh-card${destId === w.id ? ' selected' : ''}`}
                      onClick={() => setDestId(w.id)}
                    >
                      <div className="dest-wh-name">
                        <span>{w.flag}</span> {w.name}
                      </div>
                      <div className="dest-wh-meta">
                        {w.address || w.country || 'Warehouse location'}
                      </div>
                      {destId === w.id && <div className="dest-selected-tag">✓ Selected</div>}
                    </button>
                  ))
                )}
              </div>
            )}

            {destType === 'store' && (
              <div className="dest-warehouse-grid">
                {storeDestinations.length === 0 ? (
                  <div className="xfer-empty-dest">No stores available — add a store first</div>
                ) : (
                  storeDestinations.map((s) => (
                    <button
                      key={s.storeId}
                      type="button"
                      className={`dest-wh-card dest-store-card${destId === s.storeId ? ' selected' : ''}`}
                      onClick={() => setDestId(s.storeId)}
                    >
                      <div className="dest-wh-name">
                        <span>{s.flag || s.icon || '🏪'}</span> {s.name}
                      </div>
                      <div className="dest-wh-meta">
                        {s.city || s.address || 'Retail location'} · {s.itemsCount ?? 0} items on shelf
                      </div>
                      {destId === s.storeId && <div className="dest-selected-tag">✓ Selected</div>}
                    </button>
                  ))
                )}
              </div>
            )}

            {destType === 'shipment' && (
              <div className="dest-warehouse-grid">
                {shipmentDestinations.length === 0 ? (
                  <div className="xfer-empty-dest">No active shipments — create one under Shipping first</div>
                ) : (
                  shipmentDestinations.map((s) => {
                    const sid = s.shipmentId || s.id;
                    return (
                      <button
                        key={sid}
                        type="button"
                        className={`dest-wh-card dest-shipment-card${destId === sid ? ' selected' : ''}`}
                        onClick={() => setDestId(sid)}
                      >
                        <div className="dest-wh-name">
                          <span>{s.originFlag || '🚢'}</span> {sid}
                        </div>
                        <div className="dest-wh-meta">
                          {s.origin} → {s.dest} · {s.items ?? 0} items · {s.status}
                        </div>
                        <div className="dest-wh-meta" style={{ marginTop: 4 }}>
                          {s.carrier} · ETA {s.eta || 'TBD'}
                        </div>
                        {destId === sid && <div className="dest-selected-tag">✓ Selected</div>}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
          {success && (
            <div className="transfer-success-banner">
              <i className="fas fa-check-circle" /> {successMessage || 'Transfer completed successfully!'}
            </div>
          )}
          <div className="wh-modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary-green btn-confirm-transfer"
              disabled={!destId || !hasSelection || !qtyValid || saving}
              onClick={handleConfirm}
            >
              <i className="fas fa-exchange-alt" />{' '}
              {fromStore && destType === 'warehouse'
                ? 'Return to Warehouse'
                : fromStore && destType === 'store'
                  ? 'Transfer to Store'
                  : fromStore && destType === 'shipment'
                    ? 'Load onto Shipment'
                    : destType === 'store'
                      ? 'Send to Store'
                      : destType === 'shipment'
                        ? 'Load onto Shipment'
                        : 'Confirm Transfer'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
