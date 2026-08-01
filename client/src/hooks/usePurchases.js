import { useCallback, useEffect, useState } from 'react';
import { purchasesApi } from '../api';
import { normalizePurchase, sortPurchasesNewest } from '../utils/normalizePurchase';
import { emitInventoryChanged } from '../utils/inventoryEvents';

export function usePurchases(options = {}) {
  const { supplierId, page = 1, limit = 25 } = options;
  const [purchases, setPurchases] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit, sort: '-createdAt' };
      if (supplierId) params.supplierId = supplierId;
      const res = await purchasesApi.list(params);
      const list = (res.data.purchases || res.data.data || []).map(normalizePurchase);
      const pagination = res.data.pagination || {};
      setPurchases(sortPurchasesNewest(list));
      setTotal(pagination.total ?? res.data.total ?? list.length);
      setPages(pagination.pages || Math.max(1, Math.ceil((pagination.total ?? list.length) / limit)));
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load purchases');
      setPurchases([]);
      setTotal(0);
      setPages(1);
    } finally {
      setLoading(false);
    }
  }, [supplierId, page, limit]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const onFocus = () => refetch();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refetch]);

  const bulkDelete = useCallback(
    async (ids) => {
      const res = await purchasesApi.bulkDelete(ids);
      emitInventoryChanged();
      await refetch();
      return res.data.deleted ?? ids.length;
    },
    [refetch]
  );

  const bulkUpdate = useCallback(
    async (ids, updates) => {
      const res = await purchasesApi.bulkUpdate(ids, updates);
      emitInventoryChanged();
      await refetch();
      return res.data;
    },
    [refetch]
  );

  const removeOne = useCallback(
    async (id) => {
      await purchasesApi.remove(id);
      emitInventoryChanged();
      await refetch();
    },
    [refetch]
  );

  return {
    purchases,
    total,
    pages,
    page,
    limit,
    loading,
    error,
    refetch,
    bulkDelete,
    bulkUpdate,
    removeOne,
    pagination: { page, pageSize: limit, total, pages }
  };
}
