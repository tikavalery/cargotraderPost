/** Country code or name → flag emoji for supplier display */
export function supplierFlag(country) {
  if (!country) return '';
  const flags = {
    CN: '🇨🇳',
    China: '🇨🇳',
    AE: '🇦🇪',
    UAE: '🇦🇪',
    Dubai: '🇦🇪',
    TR: '🇹🇷',
    Turkey: '🇹🇷',
    US: '🇺🇸',
    USA: '🇺🇸',
    MA: '🇲🇦',
    Morocco: '🇲🇦',
    CM: '🇨🇲',
    Cameroon: '🇨🇲'
  };
  return flags[country] || flags[country.toUpperCase?.()] || '';
}

export function formatSupplierLabel(item, suppliers = []) {
  if (item?.supplier?.name) {
    return `${supplierFlag(item.supplier.country)} ${item.supplier.name}`.trim();
  }
  const ref = item?.supplierId;
  if (!ref) return '—';
  const sup = suppliers.find(
    (s) => s.supplierId === ref || String(s._id) === String(ref)
  );
  if (sup) return `${supplierFlag(sup.country)} ${sup.name}`.trim();
  return String(ref);
}

export function resolveSupplierFromList(item, suppliers = []) {
  const ref = item?.supplierId || item?.supplier?.supplierId;
  if (!ref) return null;
  return suppliers.find((s) => s.supplierId === ref || String(s._id) === String(ref)) || null;
}

export function statusBadgeClass(status) {
  const map = {
    Stored: 'status-stored',
    'In Store': 'status-store',
    'On Ship': 'status-ship',
    Sold: 'status-sold',
    Returned: 'status-returned',
    'Low Stock': 'status-low',
    'In Stock': 'status-stored',
    'In Transit': 'status-ship'
  };
  return map[status] || 'status-stored';
}
