import { useCallback, useEffect, useState } from 'react';
import { warehousesApi } from '../api';
import { onInventoryChanged } from '../utils/inventoryEvents';

export function useWarehouses() {
  const [warehouses, setWarehouses] = useState([]);
  const [meta, setMeta] = useState({ locationCount: 0, countryCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await warehousesApi.list();
      setWarehouses(res.data.warehouses || []);
      setMeta(res.data.meta || {});
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load warehouses');
      setWarehouses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => onInventoryChanged(refetch), [refetch]);

  return { warehouses, meta, loading, error, refetch };
}

export function filterWarehouses(list, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (w) =>
      w.name?.toLowerCase().includes(q) ||
      w.address?.toLowerCase().includes(q) ||
      w.manager?.toLowerCase().includes(q)
  );
}
