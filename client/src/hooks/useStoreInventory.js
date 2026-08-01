import { useCallback, useEffect, useState } from 'react';
import { storesApi } from '../services/posApi';
import { onInventoryChanged } from '../utils/inventoryEvents';

export function useStoreInventory(storeId, {
  category = '',
  search = '',
  page = 1,
  limit = 25,
  paginated = true
} = {}) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ itemsCount: 0, skuCount: 0, valueXaf: 0 });
  const [store, setStore] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!storeId) {
      setItems([]);
      setSummary({ itemsCount: 0, skuCount: 0, valueXaf: 0 });
      setStore(null);
      setPagination({ page: 1, pageSize: limit, total: 0, pages: 1 });
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = {
        category: category || undefined,
        search: search?.trim() || undefined
      };
      if (paginated) {
        params.page = page;
        params.limit = limit;
      }
      const res = await storesApi.inventory(storeId, params);
      setItems(res.data?.items || res.data?.data || []);
      setSummary(res.data?.summary || { itemsCount: 0, skuCount: 0, valueXaf: 0 });
      setStore(res.data?.store || null);
      const p = res.data?.pagination;
      if (p) {
        setPagination({
          page: Number(p.page) || page,
          pageSize: Number(p.pageSize || p.limit) || limit,
          total: Number(p.total) || 0,
          pages: Number(p.pages) || 1
        });
      } else {
        const list = res.data?.items || res.data?.data || [];
        setPagination({ page: 1, pageSize: list.length || limit, total: list.length, pages: 1 });
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load store inventory');
      setItems([]);
      setSummary({ itemsCount: 0, skuCount: 0, valueXaf: 0 });
      setPagination({ page: 1, pageSize: limit, total: 0, pages: 1 });
    } finally {
      setLoading(false);
    }
  }, [storeId, category, search, page, limit, paginated]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => onInventoryChanged(refetch), [refetch]);

  return { items, summary, store, pagination, loading, error, refetch };
}
