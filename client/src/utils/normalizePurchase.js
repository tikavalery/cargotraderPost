export function normalizePurchase(p) {
  if (!p) return null;
  const qty = Math.max(Number(p.quantity) || 0, 1);
  let purchasePrice = parseInt(p.purchasePrice, 10) || 0;
  let purchaseValue = parseInt(p.purchaseValue, 10) || purchasePrice * qty;
  let targetPrice = parseInt(p.targetPrice, 10) || 0;
  let value = parseInt(p.value, 10) || targetPrice * qty;

  if (!purchasePrice && purchaseValue && qty) purchasePrice = Math.round(purchaseValue / qty);
  if (!targetPrice && value && qty) targetPrice = Math.round(value / qty);

  const purchaseId = p.id || p.purchaseId;
  let purchaseDate = '';
  if (p.purchaseDate) {
    purchaseDate =
      typeof p.purchaseDate === 'string'
        ? p.purchaseDate.slice(0, 10)
        : new Date(p.purchaseDate).toISOString().slice(0, 10);
  }

  return {
    ...p,
    id: purchaseId,
    purchaseId,
    quantity: qty,
    purchasePrice,
    purchaseValue,
    targetPrice,
    value,
    purchaseDate,
    selectId: purchaseId
  };
}

export function filterPurchases(purchases, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return purchases;
  return purchases.filter((p) => {
    const name = (p.itemName || '').toLowerCase();
    const id = (p.id || p.purchaseId || '').toLowerCase();
    const sku = (p.sku || '').toLowerCase();
    const category = (p.category || '').toLowerCase();
    const supplierName = (p.supplier?.name || p.supplierName || '').toLowerCase();
    const supplierId = (p.supplier?.supplierId || p.supplierId || '').toLowerCase();
    return (
      name.includes(q) ||
      id.includes(q) ||
      sku.includes(q) ||
      category.includes(q) ||
      supplierName.includes(q) ||
      supplierId.includes(q)
    );
  });
}

export function sortPurchasesNewest(purchases) {
  return [...purchases].sort((a, b) => {
    const da = new Date(a.createdAt || a.purchaseDate || 0).getTime();
    const db = new Date(b.createdAt || b.purchaseDate || 0).getTime();
    return db - da;
  });
}
