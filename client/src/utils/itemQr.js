/** Build scan payload compatible with POS lookup and parseScanPayload(). */
export function buildItemQrPayload({ sku, itemId }) {
  const code = String(sku || itemId || '').trim();
  if (!code) return '';
  return `afritrade:item/${code}`;
}

export function toQrRecord(record, options = {}) {
  if (!record) return null;
  const sku = options.sku || record.sku || record.itemId || record.productId || '';
  return {
    name: record.name || 'Product',
    sku,
    type: 'item',
    subtitle: options.subtitle || record.category || 'Individual Item'
  };
}
