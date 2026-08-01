import { useMemo } from 'react';

function matchWarehouse(location, warehouses = []) {
  const lower = (location || '').trim().toLowerCase();
  if (!lower) return null;
  return warehouses.find((w) => (w.name || '').trim().toLowerCase() === lower);
}

export function useLocationLinks(warehouses = []) {
  return useMemo(() => {
    return (loc) => {
      const name = (loc || '').trim();
      if (!name) return { label: '—', href: null, kind: 'other' };

      const wh = matchWarehouse(name, warehouses);
      if (wh) {
        return {
          label: name,
          href: `/warehouses?id=${encodeURIComponent(wh._id || wh.id)}`,
          kind: 'warehouse'
        };
      }

      const lower = name.toLowerCase();
      if (/transit|on ship|douala port|port/i.test(lower)) {
        return { label: name, href: '/shipping', kind: 'shipping' };
      }

      return { label: name, href: null, kind: 'other' };
    };
  }, [warehouses]);
}
