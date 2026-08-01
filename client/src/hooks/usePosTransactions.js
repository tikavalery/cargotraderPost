import { useCallback, useEffect, useState } from 'react';
import { posApi } from '../services/posApi';

export function usePosTransactions(params = {}) {
  const { page = 1, limit = 25, storeId, dateFrom, dateTo } = params;
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const query = { page, limit };
      if (storeId) query.storeId = storeId;
      if (dateFrom) query.dateFrom = dateFrom;
      if (dateTo) query.dateTo = dateTo;
      const res = await posApi.transactions(query);
      const data = res.data?.data || [];
      const p = res.data?.pagination || {};
      const total = Number(p.total) || data.length;
      const pageSize = Number(p.limit) || limit;
      setTransactions(data);
      setPagination({
        page: Number(p.page) || page,
        limit: pageSize,
        total,
        pages: Math.max(1, Math.ceil(total / pageSize))
      });
    } catch {
      setTransactions([]);
      setPagination({ page: 1, limit, total: 0, pages: 1 });
    } finally {
      setLoading(false);
    }
  }, [page, limit, storeId, dateFrom, dateTo]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { transactions, pagination, loading, refetch: fetchAll };
}
