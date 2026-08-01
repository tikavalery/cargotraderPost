import { useCallback, useEffect, useState } from 'react';
import { posApi } from '../services/posApi';

export function useSalesReturns({ storeId, transactionId } = {}) {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { limit: 200 };
      if (storeId) params.storeId = storeId;
      if (transactionId) params.transactionId = transactionId;
      const res = await posApi.salesReturns(params);
      setReturns(res.data?.data || []);
    } catch (e) {
      setReturns([]);
      setError(e.response?.data?.message || 'Failed to load returns');
    } finally {
      setLoading(false);
    }
  }, [storeId, transactionId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const remove = useCallback(
    async (returnId) => {
      await posApi.deleteSalesReturn(returnId);
      await reload();
    },
    [reload]
  );

  return { returns, loading, error, reload, remove };
}
