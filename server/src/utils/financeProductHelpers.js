export function mapLineToProduct(line) {
  const qty = Number(line?.qty ?? line?.quantityReturned) || 1;
  const unitPrice = Number(line?.price ?? line?.unitPrice) || 0;
  return {
    name: String(line?.name || line?.sku || 'Item').trim(),
    sku: line?.sku || '',
    qty,
    unitPrice,
    lineTotal: unitPrice * qty,
    category: line?.category || line?.catLabel || ''
  };
}

export function summarizeProducts(products, { maxItems = 3 } = {}) {
  if (!products?.length) return '';
  const parts = products.map((p) => {
    const label = p.name || p.sku || 'Item';
    return p.qty > 1 ? `${label} (×${p.qty})` : label;
  });
  if (parts.length <= maxItems) return parts.join(', ');
  return `${parts.slice(0, maxItems).join(', ')} +${parts.length - maxItems} more`;
}

export function revenueDescriptionFromProducts(products, fallback = '') {
  return summarizeProducts(products) || fallback;
}

export function productsFromLines(lines) {
  return (lines || []).map(mapLineToProduct).filter((p) => p.name || p.sku);
}
