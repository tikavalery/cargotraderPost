import { useCallback, useEffect, useState } from 'react';
import { posApi } from '../services/posApi';

export function useHeldSales(storeId) {
  const [held, setHeld] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await posApi.held(storeId ? { storeId } : {});
      setHeld(res.data?.data || []);
    } catch {
      setHeld([]);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const create = useCallback(
    async (data) => {
      const res = await posApi.createHeld(data);
      await fetchAll();
      return res.data?.data;
    },
    [fetchAll]
  );

  const remove = useCallback(
    async (heldId) => {
      await posApi.deleteHeld(heldId);
      await fetchAll();
    },
    [fetchAll]
  );

  return { held, loading, refetch: fetchAll, create, remove };
}
