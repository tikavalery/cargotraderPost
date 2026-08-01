import { useCallback, useEffect, useState } from 'react';
import { warehousesApi } from '../api';
import { onInventoryChanged } from '../utils/inventoryEvents';

export function useWarehouseDetail(warehouseId, {
  category = '',
  search = '',
  page = 1,
  limit = 25,
  paginated = true
} = {}) {
  const [warehouse, setWarehouse] = useState(null);
  const [stock, setStock] = useState([]);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, pages: 1 });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!warehouseId) return;
    setLoading(true);
    try {
      const stockParams = {};
      if (category) stockParams.category = category;
      if (search?.trim()) stockParams.search = search.trim();
      if (paginated) {
        stockParams.page = page;
        stockParams.limit = limit;
      }

      const [whRes, stockRes, logsRes] = await Promise.all([
        warehousesApi.get(warehouseId),
        warehousesApi.stock(warehouseId, stockParams),
        warehousesApi.logs(warehouseId)
      ]);
      setWarehouse(whRes.data.data);
      setStock(stockRes.data.data || []);
      setLogs(logsRes.data.data || []);
      const p = stockRes.data.pagination;
      if (p) {
        setPagination({
          page: Number(p.page) || page,
          pageSize: Number(p.pageSize || p.limit) || limit,
          total: Number(p.total) || 0,
          pages: Number(p.pages) || 1
        });
      } else {
        const list = stockRes.data.data || [];
        setPagination({ page: 1, pageSize: list.length || limit, total: list.length, pages: 1 });
      }
    } catch {
      setWarehouse(null);
      setStock([]);
      setPagination({ page: 1, pageSize: limit, total: 0, pages: 1 });
    } finally {
      setLoading(false);
    }
  }, [warehouseId, category, search, page, limit, paginated]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => onInventoryChanged(load), [load]);

  return { warehouse, stock, logs, pagination, loading, reload: load };
}
