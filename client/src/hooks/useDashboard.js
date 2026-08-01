import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrency } from '../context/CurrencyContext';
import { useAuth } from '../context/AuthContext';
import { dashboardApi } from '../services/dashboardApi';
import { onInventoryChanged } from '../utils/inventoryEvents';

export function useDashboard(financePeriod = 'month') {
  const { currency } = useCurrency();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    return onInventoryChanged(() => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
    });
  }, [isAuthenticated, queryClient]);

  return useQuery({
    queryKey: ['dashboard', 'summary', financePeriod, currency],
    queryFn: async () => {
      const res = await dashboardApi.summary({ financePeriod, currency });
      return res.data?.data;
    },
    enabled: isAuthenticated,
    staleTime: 60_000
  });
}
