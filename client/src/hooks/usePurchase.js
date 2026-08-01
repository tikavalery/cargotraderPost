import { useCallback, useEffect, useState } from 'react';
import { purchasesApi } from '../api';

export function usePurchase(purchaseId) {
  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(!!purchaseId);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!purchaseId) {
      setPurchase(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await purchasesApi.get(purchaseId);
      setPurchase(res.data.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load purchase');
      setPurchase(null);
    } finally {
      setLoading(false);
    }
  }, [purchaseId]);

  useEffect(() => {
    load();
  }, [load]);

  return { purchase, loading, error, reload: load };
}
