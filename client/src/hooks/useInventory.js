import { useCallback, useEffect, useState } from 'react';
import { inventoryItemsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { onInventoryChanged } from '../utils/inventoryEvents';

/** Sentinel value for API group filter — items with no group assigned */
export const UNGROUPED_FILTER = '__ungrouped__';

export function itemGroupLabel(item) {
  const g = item?.group?.trim();
  return g || 'Ungrouped';
}

export function useInventoryItems(filters) {
  const { user, loading: authLoading } = useAuth();
  const businessId = user?.defaultBusinessId;
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize || filters.limit) || 25));

  const fetchItems = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: pageSize };
      if (filters.search) params.search = filters.search;
      if (filters.category) params.category = filters.category;
      if (filters.location) params.location = filters.location;
      if (filters.group) params.group = filters.group;
      if (filters.warehouseId) params.warehouseId = filters.warehouseId;
      const res = await inventoryItemsApi.list(params);
      const p = res.data.pagination || {};
      setItems(res.data.data || []);
      setPagination({
        page: Number(p.page) || page,
        pageSize: Number(p.pageSize || p.limit) || pageSize,
        total: Number(p.total) || 0,
        pages: Number(p.pages) || Math.max(1, Math.ceil((Number(p.total) || 0) / pageSize))
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load items');
      setItems([]);
      setPagination({ page: 1, pageSize, total: 0, pages: 1 });
    } finally {
      setLoading(false);
    }
  }, [
    filters.search,
    filters.category,
    filters.location,
    filters.group,
    filters.warehouseId,
    page,
    pageSize,
    authLoading,
    businessId
  ]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => onInventoryChanged(fetchItems), [fetchItems]);

  useEffect(() => {
    const onWarehouseChanged = () => {
      fetchItems();
    };
    window.addEventListener('afritrade:warehouse-changed', onWarehouseChanged);
    return () => window.removeEventListener('afritrade:warehouse-changed', onWarehouseChanged);
  }, [fetchItems]);

  return { items, pagination, loading, error, refetch: fetchItems };
}

export function useInventoryMeta() {
  const [locations, setLocations] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [groups, setGroups] = useState([]);

  const load = useCallback(async () => {
    const [locRes, supRes, grpRes] = await Promise.all([
      inventoryItemsApi.locations().catch(() => ({ data: { data: [] } })),
      inventoryItemsApi.suppliers().catch(() => ({ data: { data: [] } })),
      inventoryItemsApi.groups().catch(() => ({ data: { data: [] } }))
    ]);
    setLocations(locRes.data.data || []);
    setSuppliers(supRes.data.data || []);
    setGroups(grpRes.data.data || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { locations, suppliers, groups, reloadMeta: load };
}

export function useInventorySelection(items) {
  const [selected, setSelected] = useState(new Set());

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i._id)));
  };

  const clear = () => setSelected(new Set());

  const selectedItems = items.filter((i) => selected.has(i._id));
  const allSelected = items.length > 0 && selected.size === items.length;
  const indeterminate = selected.size > 0 && selected.size < items.length;

  return { selected, selectedItems, toggle, toggleAll, clear, allSelected, indeterminate, count: selected.size };
}
