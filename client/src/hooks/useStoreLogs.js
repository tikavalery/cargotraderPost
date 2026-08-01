import { useCallback, useEffect, useState } from 'react';
import { storesApi } from '../services/posApi';
import { onInventoryChanged } from '../utils/inventoryEvents';

export function useStoreLogs(storeId) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!storeId) {
      setLogs([]);
      return;
    }
    setLoading(true);
    try {
      const res = await storesApi.logs(storeId);
      setLogs(res.data?.data || []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => onInventoryChanged(refetch), [refetch]);

  return { logs, loading, refetch };
}
