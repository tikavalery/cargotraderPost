import { useCallback, useEffect, useState } from 'react';
import api from '../api';

export function useGroupedLocations(extraLocation = '') {
  const [groups, setGroups] = useState([]);
  const [defaultLocation, setDefaultLocation] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/locations', { params: { grouped: 'true' } });
      const g = res.data.groups || [];
      setGroups(g);
      const firstWh = g.find((x) => x.label === 'Warehouses')?.items?.[0];
      const firstStore = g.find((x) => x.label === 'Stores')?.items?.[0];
      // Prefer a real warehouse, otherwise first store — never leave '' when options exist
      // (an empty controlled <select> visually shows the first option but saves blank).
      setDefaultLocation(firstWh?.name || firstStore?.name || '');
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const allNames = groups.flatMap((grp) => grp.items.map((i) => i.name));
  const locationExists = !extraLocation || allNames.includes(extraLocation);

  const displayGroups = [...groups];
  if (extraLocation && !locationExists) {
    const other = displayGroups.find((g) => g.label === 'Other');
    if (other) {
      other.items = [...other.items, { name: extraLocation, type: 'other' }];
    } else {
      displayGroups.push({
        label: 'Other',
        items: [{ name: extraLocation, type: 'other' }]
      });
    }
  }

  return { groups: displayGroups, defaultLocation, loading, refresh };
}
