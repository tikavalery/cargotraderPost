import { useCallback, useEffect, useState } from 'react';
import { shippingApi } from '../services/shippingApi';

export function useShipments(options = {}) {
  const { mode = 'active', page = 1, limit = 50 } = options;
  const [shipments, setShipments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async ({ soft = false } = {}) => {
    if (!soft) setLoading(true);
    setError(null);
    try {
      const res = await shippingApi.list({ mode, page, limit });
      setShipments(res.data.shipments || []);
      setPagination(res.data.pagination || { page, limit, total: 0, pages: 1 });
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load shipments');
      setShipments([]);
    } finally {
      setLoading(false);
    }
  }, [mode, page, limit]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const remove = useCallback(
    async (id) => {
      await shippingApi.remove(id);
      await refetch();
    },
    [refetch]
  );

  const create = useCallback(
    async (data) => {
      const res = await shippingApi.create(data);
      await refetch();
      return res.data.data;
    },
    [refetch]
  );

  return { shipments, pagination, loading, error, refetch, remove, create };
}

export function useShipmentStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await shippingApi.stats();
      setStats(res.data);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { stats, loading, refetch };
}

const DOC_STATUS_CHIP_MAP = {
  Verified: 'verified',
  'Pending Review': 'pending',
  'Expiring Soon': 'expiring'
};

/**
 * @param {{
 *   page?: number,
 *   limit?: number,
 *   search?: string,
 *   statusChip?: string,
 *   type?: string,
 *   shipmentId?: string,
 *   paginated?: boolean
 * }} [options]
 */
export function useShipmentDocuments(options = {}) {
  const {
    page = 1,
    limit = 25,
    search = '',
    statusChip = 'All',
    type = 'all',
    shipmentId = '',
    paginated = true
  } = options;
  const [documents, setDocuments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search?.trim()) params.search = search.trim();
      if (statusChip && statusChip !== 'All') {
        params.status = DOC_STATUS_CHIP_MAP[statusChip] || String(statusChip).toLowerCase();
      }
      if (type && type !== 'all') params.type = type;
      if (shipmentId) params.shipmentId = shipmentId;
      if (paginated) {
        params.page = page;
        params.limit = limit;
      }
      const res = await shippingApi.documents(params);
      const list = res.data.documents || [];
      setDocuments(list);
      const p = res.data.pagination;
      if (p) {
        setPagination({
          page: Number(p.page) || page,
          pageSize: Number(p.pageSize || p.limit) || limit,
          total: Number(p.total) || 0,
          pages: Number(p.pages) || 1
        });
      } else {
        setPagination({
          page: 1,
          pageSize: list.length || limit,
          total: Number(res.data.total) || list.length,
          pages: 1
        });
      }
    } catch (err) {
      setDocuments([]);
      setPagination({ page: 1, pageSize: limit, total: 0, pages: 1 });
      setError(err.response?.data?.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, statusChip, type, shipmentId, paginated]);

  useEffect(() => {
    load();
  }, [load]);

  return { documents, pagination, loading, error, reload: load };
}
