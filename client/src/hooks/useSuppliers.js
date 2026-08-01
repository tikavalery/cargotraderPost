import { useCallback, useEffect, useState } from 'react';
import { suppliersApi } from '../api';

/**
 * @param {{ page?: number, limit?: number, search?: string, paginated?: boolean }} [options]
 * When `paginated` is true (or page/limit provided), uses server pagination.
 * Otherwise loads the full supplier list (for pickers / forms).
 */
export function useSuppliers(options = {}) {
  const { page, limit, search, paginated = false } = options;
  const usePaging = paginated || page != null || limit != null;
  const [suppliers, setSuppliers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search?.trim()) params.search = search.trim();
      if (usePaging) {
        params.page = page || 1;
        params.limit = limit || 25;
      }
      const res = await suppliersApi.list(params);
      const list = res.data.data || [];
      setSuppliers(list);
      const p = res.data.pagination;
      if (p) {
        setPagination({
          page: Number(p.page) || params.page || 1,
          pageSize: Number(p.pageSize || p.limit) || params.limit || 25,
          total: Number(p.total) || 0,
          pages: Number(p.pages) || 1
        });
      } else {
        setPagination({
          page: 1,
          pageSize: list.length || 25,
          total: list.length,
          pages: 1
        });
      }
    } catch (e) {
      setSuppliers([]);
      setPagination({ page: 1, pageSize: 25, total: 0, pages: 1 });
      setError(e.response?.data?.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, [usePaging, page, limit, search]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { suppliers, pagination, loading, error, refresh };
}
