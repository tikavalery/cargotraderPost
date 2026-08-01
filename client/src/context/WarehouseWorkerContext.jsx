import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { warehousesApi } from '../api';
import { useAuth } from './AuthContext';
import { isWarehouseWorker } from '../utils/permissions';

const WarehouseWorkerContext = createContext(null);
const STORAGE_KEY = 'afritrade:active-warehouse';

function warehouseMatches(wh, key) {
  if (!wh || !key) return false;
  const k = String(key);
  return String(wh._id) === k || String(wh.warehouseId) === k || String(wh.id) === k;
}

function warehouseKey(wh) {
  if (!wh) return '';
  return String(wh._id || wh.warehouseId || wh.id || '');
}

export function WarehouseWorkerProvider({ children }) {
  const { user } = useAuth();
  const worker = isWarehouseWorker(user?.role);
  const assignedKey = (user?.assignedWarehouseIds || []).map(String).join('|');
  const assignedIds = useMemo(
    () => (user?.assignedWarehouseIds || []).map(String).filter(Boolean),
    [assignedKey]
  );
  const locked = worker && assignedIds.length === 1;
  const canSwitch = worker && assignedIds.length > 1;

  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseIdState] = useState(() => {
    if (locked) return assignedIds[0] || '';
    try {
      return localStorage.getItem(STORAGE_KEY) || assignedIds[0] || '';
    } catch {
      return assignedIds[0] || '';
    }
  });
  const [loading, setLoading] = useState(worker);

  useEffect(() => {
    if (!worker) {
      setWarehouses([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    warehousesApi
      .list()
      .then((res) => {
        if (cancelled) return;
        const list = res.data?.warehouses || [];
        const scoped = assignedIds.length
          ? list.filter((w) => assignedIds.some((id) => warehouseMatches(w, id)))
          : list;
        setWarehouses(scoped);

        let preferred = '';
        if (locked) preferred = assignedIds[0];
        else {
          try {
            preferred = warehouseId || localStorage.getItem(STORAGE_KEY) || assignedIds[0];
          } catch {
            preferred = warehouseId || assignedIds[0];
          }
        }
        const match = scoped.find((w) => warehouseMatches(w, preferred));
        const next = match ? warehouseKey(match) : warehouseKey(scoped[0]);
        if (next) {
          setWarehouseIdState(next);
          try {
            localStorage.setItem(STORAGE_KEY, next);
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {
        if (!cancelled) setWarehouses([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [worker, assignedKey, locked]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (locked && assignedIds[0]) {
      setWarehouseIdState(assignedIds[0]);
      try {
        localStorage.setItem(STORAGE_KEY, assignedIds[0]);
      } catch {
        /* ignore */
      }
    }
  }, [locked, assignedIds]);

  const setWarehouseId = useCallback(
    (id) => {
      if (!canSwitch) return;
      const wh = warehouses.find((w) => warehouseMatches(w, id));
      if (!wh) return;
      const key = warehouseKey(wh);
      setWarehouseIdState(key);
      try {
        localStorage.setItem(STORAGE_KEY, key);
      } catch {
        /* ignore */
      }
      window.dispatchEvent(
        new CustomEvent('afritrade:warehouse-changed', { detail: { warehouseId: key } })
      );
    },
    [canSwitch, warehouses]
  );

  const activeWarehouse = useMemo(() => {
    return warehouses.find((w) => warehouseMatches(w, warehouseId)) || warehouses[0] || null;
  }, [warehouses, warehouseId]);

  const value = useMemo(
    () => ({
      warehouses,
      warehouseId: warehouseKey(activeWarehouse) || warehouseId,
      setWarehouseId,
      activeWarehouse,
      loading,
      warehouseLocked: locked || !canSwitch,
      canSwitch,
      isWarehouseWorker: worker
    }),
    [warehouses, warehouseId, setWarehouseId, activeWarehouse, loading, locked, canSwitch, worker]
  );

  return (
    <WarehouseWorkerContext.Provider value={value}>{children}</WarehouseWorkerContext.Provider>
  );
}

export function useWarehouseWorker() {
  return useContext(WarehouseWorkerContext);
}

export { warehouseMatches };
