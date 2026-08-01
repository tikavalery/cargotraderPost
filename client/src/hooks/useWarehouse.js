import { useCallback, useEffect, useState } from 'react';
import { warehousesApi } from '../api';

export function useWarehouse(warehouseId) {
  const [warehouse, setWarehouse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const refetch = useCallback(async () => {
    if (!warehouseId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    try {
      const res = await warehousesApi.get(warehouseId);
      setWarehouse(res.data.data);
    } catch (e) {
      setWarehouse(null);
      setNotFound(e.response?.status === 404);
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { warehouse, loading, notFound, refetch };
}
