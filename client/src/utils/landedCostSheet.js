/** Client helpers for shipment landed-cost worksheet (XAF). */

export const DEFAULT_LANDED_RATES = {
  insurancePct: 2,
  dutyPct: 18,
  vatPct: 19.25,
  freightTotalXaf: 0,
  clearingXaf: 0
};

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
    return { ...row, ...costs, lineTotalXaf: lineTotalXaf(costs) };
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

export function computeWorksheetTotals(rows = [], rates = {}, extraFees = []) {
  const clearing = Math.max(0, Math.round(Number(rates.clearingXaf) || 0));
  const extraTotal = extraFees.reduce((s, f) => s + (Number(f.amountXaf) || 0), 0);
  const linesSubtotal = rows.reduce((s, r) => s + lineTotalXaf(r), 0);
  return {
    goodsCostXaf: rows.reduce((s, r) => s + (Number(r.purchaseCostXaf) || 0), 0),
    freightCostXaf: rows.reduce((s, r) => s + (Number(r.freightXaf) || 0), 0),
    taxCostXaf: rows.reduce(
      (s, r) =>
        s +
        (Number(r.insuranceXaf) || 0) +
        (Number(r.dutyXaf) || 0) +
        (Number(r.vatXaf) || 0),
      0
    ),
    clearingXaf: clearing,
    extraFeesXaf: extraTotal,
    grandTotalXaf: linesSubtotal + clearing + extraTotal
  };
}

export function newExtraFee() {
  return {
    id: `fee-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: '',
    amountXaf: 0
  };
}
