function sameId(a, b) {
  return a != null && b != null && String(a) === String(b);
}

function sameSku(a, b) {
  return a && b && String(a).toLowerCase() === String(b).toLowerCase();
}

export function getScanMatchLabel(scanMatch) {
  if (!scanMatch?.data) return '';
  const { matchType, data } = scanMatch;
  if (matchType === 'item') return data.name || data.sku || 'Product';
  return 'Product';
}

/** Individual Items — show only the scanned product row. */
export function filterItemsForScan(items, scanMatch) {
  if (!scanMatch) return items;
  const { matchType, data } = scanMatch;

  if (matchType === 'item') {
    const found = items.find(
      (item) => sameId(item._id, data._id) || sameSku(item.sku, data.sku)
    );
    return [found || data];
  }

  return [];
}
