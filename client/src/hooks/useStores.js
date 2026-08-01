import { useCallback, useEffect, useState } from 'react';
import { storesApi } from '../services/posApi';
import { onInventoryChanged } from '../utils/inventoryEvents';

export function useStores({ lite = false } = {}) {
  const [stores, setStores] = useState([]);
  const [meta, setMeta] = useState({ storeCount: 0, cityCount: 0, activeCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await storesApi.list(lite ? { lite: '1' } : undefined);
      setStores(res.data.stores || res.data.data || []);
      setMeta(res.data.meta || {});
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load stores');
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, [lite]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => onInventoryChanged(refetch), [refetch]);

  return { stores, meta, loading, error, refetch };
}

export function filterStores(list, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (s) =>
      s.name?.toLowerCase().includes(q) ||
      s.address?.toLowerCase().includes(q) ||
      s.city?.toLowerCase().includes(q) ||
      s.manager?.toLowerCase().includes(q) ||
      s.storeId?.toLowerCase().includes(q)
  );
}
