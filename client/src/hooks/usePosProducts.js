import { useCallback, useEffect, useState } from 'react';
import { storesApi } from '../services/posApi';
import { onInventoryChanged } from '../utils/inventoryEvents';

const SEARCH_DEBOUNCE_MS = 350;

export function usePosProducts(storeId, { category = 'All', search = '' } = {}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchProducts = useCallback(async () => {
    if (!storeId) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await storesApi.products(storeId, {
        category: category === 'All' ? undefined : category,
        search: debouncedSearch || undefined
      });
      setProducts(res.data?.data || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [storeId, category, debouncedSearch]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => onInventoryChanged(fetchProducts), [fetchProducts]);

  return { products, loading, error, refetch: fetchProducts };
}
