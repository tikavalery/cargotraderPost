import { useEffect, useMemo, useState } from 'react';
import { shippingApi } from '../../services/shippingApi';
import { formatXaf } from '../../utils/format';
import {
  DEFAULT_LANDED_RATES,
  applyLandedCostEstimates,
  computeWorksheetTotals,
  lineTotalXaf,
  newExtraFee
} from '../../utils/landedCostSheet';

function numOrEmpty(v) {
  if (v === '' || v == null) return '';
  const n = Number(v);
  return Number.isFinite(n) ? n : '';
}

function MoneyInput({ value, onChange, disabled, ariaLabel }) {
  return (
    <input
      type="number"
      min="0"
      step="1"
      className="ship-lc-input"
      value={value === '' || value == null ? '' : value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') onChange('');
        else onChange(Math.max(0, Math.round(Number(raw) || 0)));
      }}
    />
  );
}

export default function ShipmentLandedCostTab({
  shipmentId,
  open,
  readOnly = false,
  canViewCost = true,
  showToast,
  onShipmentUpdated,
  onTotalsChange
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rates, setRates] = useState(DEFAULT_LANDED_RATES);
  const [rows, setRows] = useState([]);
  const [extraFees, setExtraFees] = useState([]);
  const [dirty, setDirty] = useState(false);

  // Item lines stay in the background; rates drive freight / tax allocation
  const workingRows = useMemo(() => {
    if (!rows.length) return [];
    return applyLandedCostEstimates(rows, rates).rows;
  }, [rows, rates]);

  const totals = useMemo(
    () => computeWorksheetTotals(workingRows, rates, extraFees),
    [workingRows, rates, extraFees]
  );

  const itemCount = rows.length;
  const unitCount = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.qty) || 0), 0),
    [rows]
  );

  useEffect(() => {
    onTotalsChange?.(totals);
  }, [totals, onTotalsChange]);

  const load = () => {
    if (!shipmentId) return;
    setLoading(true);
    shippingApi
      .getLandedCost(shipmentId)
      .then((res) => {
        const data = res.data?.data || {};
        setRates({ ...DEFAULT_LANDED_RATES, ...(data.rates || {}) });
        setRows(
          (data.rows || []).map((r) => ({
            ...r,
            lineTotalXaf: lineTotalXaf(r)
          }))
        );
        setExtraFees(data.extraFees || []);
        setDirty(false);
      })
      .catch((err) => {
        showToast?.(err.response?.data?.message || 'Could not load landed cost worksheet');
        setRows([]);
        setExtraFees([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open || !shipmentId) return;
    load();
  }, [open, shipmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateRate = (key, value) => {
    setRates((r) => ({ ...r, [key]: value === '' ? '' : Number(value) }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (readOnly) return;
    setSaving(true);
    try {
      const payload = {
        rates: {
          insurancePct: Number(rates.insurancePct) || 0,
          dutyPct: Number(rates.dutyPct) || 0,
          vatPct: Number(rates.vatPct) || 0,
          freightTotalXaf: Math.round(Number(rates.freightTotalXaf) || 0),
          clearingXaf: Math.round(Number(rates.clearingXaf) || 0)
        },
        rows: workingRows.map((r) => ({
          itemKey: r.itemKey,
          purchaseCostXaf: Math.round(Number(r.purchaseCostXaf) || 0),
          freightXaf: Math.round(Number(r.freightXaf) || 0),
          insuranceXaf: Math.round(Number(r.insuranceXaf) || 0),
          dutyXaf: Math.round(Number(r.dutyXaf) || 0),
          vatXaf: Math.round(Number(r.vatXaf) || 0),
          otherXaf: Math.round(Number(r.otherXaf) || 0)
        })),
        extraFees: extraFees.map((f) => ({
          id: f.id,
          label: f.label,
          amountXaf: Math.round(Number(f.amountXaf) || 0)
        }))
      };
      const res = await shippingApi.saveLandedCost(shipmentId, payload);
      const data = res.data?.data || {};
      setRates({ ...DEFAULT_LANDED_RATES, ...(data.rates || {}) });
      setRows((data.rows || []).map((r) => ({ ...r, lineTotalXaf: lineTotalXaf(r) })));
      setExtraFees(data.extraFees || []);
      setDirty(false);
      showToast?.(res.data?.message || 'Landed cost saved', 'success');
      onShipmentUpdated?.(res.data?.shipment);
    } catch (err) {
      showToast?.(err.response?.data?.message || 'Could not save landed cost');
    } finally {
      setSaving(false);
    }
  };

  const addFee = () => {
    setExtraFees((prev) => [...prev, newExtraFee()]);
    setDirty(true);
  };

  const updateFee = (id, key, value) => {
    setExtraFees((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [key]: key === 'amountXaf' ? numOrEmpty(value) : value } : f))
    );
    setDirty(true);
  };

  const removeFee = (id) => {
    setExtraFees((prev) => prev.filter((f) => f.id !== id));
    setDirty(true);
  };

  if (!canViewCost) {
    return (
      <div className="ship-lc-empty">
        <i className="fas fa-lock" />
        <p>You do not have permission to view cost details.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <p className="ship-lc-loading">
        <i className="fas fa-spinner fa-spin" /> Loading landed cost…
      </p>
    );
  }

  return (
    <div className="ship-lc-panel">
      <div className="ship-lc-toolbar">
        <div className="ship-lc-toolbar-text">
          <h3 className="ship-lc-title">Landed cost worksheet</h3>
          <p className="ship-lc-sub">
            Set rates and fees here. Item costs are calculated in the background from Individual Items
            ({itemCount} line{itemCount === 1 ? '' : 's'} · {unitCount} unit{unitCount === 1 ? '' : 's'}).
          </p>
        </div>
        {!readOnly && (
          <div className="ship-lc-toolbar-actions">
            <button
              type="button"
              className="btn-save-changes ship-lc-btn"
              disabled={saving || !dirty}
              onClick={handleSave}
            >
              <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`} />
              {saving ? 'Saving…' : dirty ? 'Save worksheet' : 'Saved'}
            </button>
          </div>
        )}
      </div>

      {!itemCount ? (
        <div className="ship-lc-empty">
          <i className="fas fa-box-open" />
          <p>No items on this shipment yet. Transfer stock under Individual Items first.</p>
        </div>
      ) : (
        <div className="ship-lc-goods-banner">
          <div>
            <span className="ship-lc-goods-label">Goods (from items)</span>
            <strong className="ship-lc-goods-val">{formatXaf(totals.goodsCostXaf)}</strong>
          </div>
          <p className="ship-lc-sub" style={{ margin: 0 }}>
            Purchase totals stay linked to stock on this shipment; freight, tax, and extra fees are set below.
          </p>
        </div>
      )}

      <div className="ship-lc-rates">
        <div className="ship-lc-rate">
          <label htmlFor="lc-ins">Insurance %</label>
          <input
            id="lc-ins"
            type="number"
            min="0"
            step="0.1"
            className="ship-lc-input"
            value={rates.insurancePct}
            disabled={readOnly || !itemCount}
            onChange={(e) => updateRate('insurancePct', e.target.value)}
          />
        </div>
        <div className="ship-lc-rate">
          <label htmlFor="lc-duty">Duty %</label>
          <input
            id="lc-duty"
            type="number"
            min="0"
            step="0.1"
            className="ship-lc-input"
            value={rates.dutyPct}
            disabled={readOnly || !itemCount}
            onChange={(e) => updateRate('dutyPct', e.target.value)}
          />
        </div>
        <div className="ship-lc-rate">
          <label htmlFor="lc-vat">VAT %</label>
          <input
            id="lc-vat"
            type="number"
            min="0"
            step="0.1"
            className="ship-lc-input"
            value={rates.vatPct}
            disabled={readOnly || !itemCount}
            onChange={(e) => updateRate('vatPct', e.target.value)}
          />
        </div>
        <div className="ship-lc-rate">
          <label htmlFor="lc-freight">Freight total</label>
          <MoneyInput
            value={rates.freightTotalXaf}
            disabled={readOnly || !itemCount}
            ariaLabel="Freight total"
            onChange={(v) => updateRate('freightTotalXaf', v)}
          />
        </div>
        <div className="ship-lc-rate">
          <label htmlFor="lc-clear">Clearing / handling</label>
          <MoneyInput
            value={rates.clearingXaf}
            disabled={readOnly || !itemCount}
            ariaLabel="Clearing fee"
            onChange={(v) => updateRate('clearingXaf', v)}
          />
        </div>
      </div>

      <div className="ship-lc-extras">
        <div className="ship-lc-extras-head">
          <h4>Other fees</h4>
          {!readOnly && (
            <button type="button" className="btn-ghost ship-lc-btn" onClick={addFee}>
              <i className="fas fa-plus" /> Add fee
            </button>
          )}
        </div>
        <p className="ship-lc-sub">
          Port storage, agent fees, demurrage, or anything else not covered above.
        </p>
        {!extraFees.length ? (
          <p className="ship-lc-extras-empty">No extra fees yet.</p>
        ) : (
          <ul className="ship-lc-fee-list">
            {extraFees.map((fee) => (
              <li key={fee.id} className="ship-lc-fee-row">
                <input
                  className="form-input ship-lc-fee-label"
                  placeholder="Fee name"
                  value={fee.label}
                  disabled={readOnly}
                  onChange={(e) => updateFee(fee.id, 'label', e.target.value)}
                />
                <MoneyInput
                  value={fee.amountXaf}
                  disabled={readOnly}
                  ariaLabel={`${fee.label || 'Fee'} amount`}
                  onChange={(v) => updateFee(fee.id, 'amountXaf', v)}
                />
                {!readOnly && (
                  <button
                    type="button"
                    className="ship-lc-fee-remove"
                    aria-label="Remove fee"
                    onClick={() => removeFee(fee.id)}
                  >
                    <i className="fas fa-trash-alt" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
