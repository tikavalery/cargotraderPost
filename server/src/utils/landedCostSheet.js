/** Per-shipment landed cost worksheet (amounts in XAF). */

export const DEFAULT_LANDED_RATES = {
  insurancePct: 2,
  dutyPct: 18,
  vatPct: 19.25,
  freightTotalXaf: 0,
  clearingXaf: 0
};

export function emptyLineCosts() {
  return {
    purchaseCostXaf: 0,
    freightXaf: 0,
    insuranceXaf: 0,
    dutyXaf: 0,
    vatXaf: 0,
    otherXaf: 0
  };
}

export function lineTotalXaf(line = {}) {
  return (
    (Number(line.purchaseCostXaf) || 0) +
    (Number(line.freightXaf) || 0) +
    (Number(line.insuranceXaf) || 0) +
    (Number(line.dutyXaf) || 0) +
    (Number(line.vatXaf) || 0) +
    (Number(line.otherXaf) || 0)
  );
}

export function readLandedCostSheet(shipmentDoc) {
  const tracking = shipmentDoc?.tracking || {};
  const sheet = tracking.landedCostSheet;
  if (!sheet || typeof sheet !== 'object') {
    return {
      rates: { ...DEFAULT_LANDED_RATES },
      lines: {},
      extraFees: []
    };
  }
  return {
    rates: { ...DEFAULT_LANDED_RATES, ...(sheet.rates || {}) },
    lines: sheet.lines && typeof sheet.lines === 'object' ? sheet.lines : {},
    extraFees: Array.isArray(sheet.extraFees) ? sheet.extraFees : []
  };
}

export function normalizeExtraFees(fees = []) {
  return (Array.isArray(fees) ? fees : [])
    .map((f, i) => ({
      id: String(f?.id || `fee-${i}-${Date.now()}`),
      label: String(f?.label || '').trim() || `Extra fee ${i + 1}`,
      amountXaf: Math.max(0, Math.round(Number(f?.amountXaf) || 0))
    }))
    .filter((f) => f.label);
}

export function normalizeLine(raw = {}, fallbackPurchase = 0) {
  return {
    purchaseCostXaf: Math.max(
      0,
      Math.round(Number(raw.purchaseCostXaf ?? fallbackPurchase) || 0)
    ),
    freightXaf: Math.max(0, Math.round(Number(raw.freightXaf) || 0)),
    insuranceXaf: Math.max(0, Math.round(Number(raw.insuranceXaf) || 0)),
    dutyXaf: Math.max(0, Math.round(Number(raw.dutyXaf) || 0)),
    vatXaf: Math.max(0, Math.round(Number(raw.vatXaf) || 0)),
    otherXaf: Math.max(0, Math.round(Number(raw.otherXaf) || 0))
  };
}

/** Build worksheet rows from stock items + saved overrides. */
export function buildLandedCostWorksheet(items = [], savedSheet = null) {
  const sheet = savedSheet || {
    rates: { ...DEFAULT_LANDED_RATES },
    lines: {},
    extraFees: []
  };
  const rates = { ...DEFAULT_LANDED_RATES, ...(sheet.rates || {}) };
  const savedLines = sheet.lines || {};

  const rows = items.map((item) => {
    const itemKey = String(item._id || item.id);
    const qty = Math.max(0, Number(item.qty) || 0);
    const unit = Math.max(0, Number(item.purchasePrice) || 0);
    const defaultPurchase = Math.round(qty * unit);
    const saved = savedLines[itemKey];
    const costs = normalizeLine(saved, defaultPurchase);
    return {
      itemKey,
      _id: itemKey,
      name: item.name || 'Item',
      sku: item.sku || '',
      qty,
      unitPurchasePrice: unit,
      ...costs,
      lineTotalXaf: lineTotalXaf(costs)
    };
  });

  const extraFees = normalizeExtraFees(sheet.extraFees);
  const linesSubtotal = rows.reduce((s, r) => s + r.lineTotalXaf, 0);
  const extraTotal = extraFees.reduce((s, f) => s + (Number(f.amountXaf) || 0), 0);
  const clearing = Math.max(0, Math.round(Number(rates.clearingXaf) || 0));
  const goodsCostXaf = rows.reduce((s, r) => s + (Number(r.purchaseCostXaf) || 0), 0);
  const freightCostXaf = rows.reduce((s, r) => s + (Number(r.freightXaf) || 0), 0);
  const taxCostXaf = rows.reduce(
    (s, r) =>
      s +
      (Number(r.insuranceXaf) || 0) +
      (Number(r.dutyXaf) || 0) +
      (Number(r.vatXaf) || 0),
    0
  );

  return {
    rates,
    rows,
    extraFees,
    totals: {
      goodsCostXaf,
      freightCostXaf,
      taxCostXaf,
      clearingXaf: clearing,
      extraFeesXaf: extraTotal,
      grandTotalXaf: linesSubtotal + clearing + extraTotal
    }
  };
}

/**
 * Apply estimate rates across lines.
 * Freight + clearing allocated by purchase-cost share.
 */
export function applyLandedCostEstimates(rows = [], ratesInput = {}) {
  const rates = { ...DEFAULT_LANDED_RATES, ...ratesInput };
  const insurancePct = Number(rates.insurancePct) || 0;
  const dutyPct = Number(rates.dutyPct) || 0;
  const vatPct = Number(rates.vatPct) || 0;
  const freightTotal = Math.max(0, Math.round(Number(rates.freightTotalXaf) || 0));
  const clearingTotal = Math.max(0, Math.round(Number(rates.clearingXaf) || 0));

  const purchaseTotal = rows.reduce((s, r) => s + (Number(r.purchaseCostXaf) || 0), 0) || 1;

  const nextRows = rows.map((row) => {
    const purchase = Math.max(0, Math.round(Number(row.purchaseCostXaf) || 0));
    const share = purchase / purchaseTotal;
    const freight = Math.round(freightTotal * share);
    const insurance = Math.round(purchase * (insurancePct / 100));
    const duty = Math.round((purchase + freight) * (dutyPct / 100));
    const vat = Math.round((purchase + freight + insurance + duty) * (vatPct / 100));
    const costs = {
      purchaseCostXaf: purchase,
      freightXaf: freight,
      insuranceXaf: insurance,
      dutyXaf: duty,
      vatXaf: vat,
      otherXaf: Math.max(0, Math.round(Number(row.otherXaf) || 0))
    };
    return {
      ...row,
      ...costs,
      lineTotalXaf: lineTotalXaf(costs)
    };
  });

  return {
    rates: {
      insurancePct,
      dutyPct,
      vatPct,
      freightTotalXaf: freightTotal,
      clearingXaf: clearingTotal
    },
    rows: nextRows
  };
}

export function sheetPayloadFromWorksheet(worksheet) {
  const lines = {};
  for (const row of worksheet.rows || []) {
    lines[row.itemKey] = {
      purchaseCostXaf: Math.round(Number(row.purchaseCostXaf) || 0),
      freightXaf: Math.round(Number(row.freightXaf) || 0),
      insuranceXaf: Math.round(Number(row.insuranceXaf) || 0),
      dutyXaf: Math.round(Number(row.dutyXaf) || 0),
      vatXaf: Math.round(Number(row.vatXaf) || 0),
      otherXaf: Math.round(Number(row.otherXaf) || 0)
    };
  }
  return {
    version: 1,
    rates: { ...DEFAULT_LANDED_RATES, ...(worksheet.rates || {}) },
    lines,
    extraFees: normalizeExtraFees(worksheet.extraFees),
    updatedAt: new Date().toISOString()
  };
}
