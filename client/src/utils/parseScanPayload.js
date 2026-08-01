export function parseScanPayload(raw) {
  if (!raw) return '';
  const code = String(raw).trim();
  try {
    if (code.startsWith('{')) {
      const j = JSON.parse(code);
      return j.sku || j.id || j.productId || code;
    }
    if (code.includes('afritrade:bale/')) {
      return code.split('afritrade:bale/')[1]?.split(/[?#/]/)[0] || code;
    }
    if (code.includes('afritrade:item/')) {
      return code.split('afritrade:item/')[1]?.split(/[?#/]/)[0] || code;
    }
    if (code.startsWith('http')) {
      const u = new URL(code);
      const fromQuery = u.searchParams.get('sku') || u.searchParams.get('code') || u.searchParams.get('id');
      if (fromQuery) return fromQuery;
      return u.pathname.split('/').pop() || code;
    }
  } catch {
    /* fall through */
  }
  return code;
}

export function parseScanKind(raw) {
  const code = String(raw || '').trim();
  if (code.includes('afritrade:bale/')) return 'bale';
  if (code.includes('afritrade:item/')) return 'item';
  return 'auto';
}
