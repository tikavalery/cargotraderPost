import { useCallback, useEffect, useState } from 'react';
import { subscriptionApi } from '../services/subscriptionApi';
import { onInventoryChanged } from '../utils/inventoryEvents';

function limitFlags(limit, used) {
  if (limit == null) {
    return { atLimit: false, overLimit: false, canCreate: true };
  }
  const n = Number(used) || 0;
  const overLimit = n > limit;
  const atLimit = n >= limit;
  return { atLimit, overLimit, canCreate: !atLimit };
}

export function usePlanUsage() {
  const [usage, setUsage] = useState(null);

  const reload = useCallback(() => {
    subscriptionApi
      .usage()
      .then((res) => setUsage(res.data))
      .catch(() => setUsage(null));
  }, []);

  useEffect(() => {
    reload();
    return onInventoryChanged(reload);
  }, [reload]);

  const inventoryLimit = usage?.limits?.inventoryItems;
  const inventoryUsed = usage?.usage?.inventoryItems ?? 0;
  const inventory = limitFlags(inventoryLimit, inventoryUsed);

  const warehouseLimit = usage?.limits?.warehouses;
  const warehousesUsed = usage?.usage?.warehouses ?? 0;
  const warehouses = limitFlags(warehouseLimit, warehousesUsed);

  const userLimit = usage?.limits?.users;
  const usersUsed = usage?.usage?.users ?? 0;
  const users = limitFlags(userLimit, usersUsed);

  const storeLimit = usage?.limits?.stores;
  const storesUsed = usage?.usage?.stores ?? 0;
  const stores = limitFlags(storeLimit, storesUsed);

  const shipmentLimit = usage?.limits?.shipmentsPerYear;
  const shipmentsUsed = usage?.usage?.shipmentsThisYear ?? 0;
  const shipments = limitFlags(shipmentLimit, shipmentsUsed);

  const aiLimit = usage?.limits?.aiAnalysesPerMonth;
  const aiUsed = usage?.usage?.aiAnalysesThisMonth ?? 0;
  const ai = limitFlags(aiLimit, aiUsed);

  return {
    usage,
    planId: usage?.planId || 'free',
    policy: usage?.policy || 'grandfather',
    policySummary: usage?.policySummary || '',
    overLimitKeys: usage?.overLimitKeys || [],

    inventoryLimit,
    inventoryUsed,
    atInventoryLimit: inventory.atLimit,
    overInventoryLimit: inventory.overLimit,

    warehouseLimit,
    warehousesUsed,
    atWarehouseLimit: warehouses.atLimit,
    overWarehouseLimit: warehouses.overLimit,

    userLimit,
    usersUsed,
    atUserLimit: users.atLimit,
    overUserLimit: users.overLimit,

    storeLimit,
    storesUsed,
    atStoreLimit: stores.atLimit,
    overStoreLimit: stores.overLimit,

    shipmentLimit,
    shipmentsUsed,
    atShipmentLimit: shipments.atLimit,
    overShipmentLimit: shipments.overLimit,

    aiLimit,
    aiUsed,
    atAiLimit: ai.atLimit,
    overAiLimit: ai.overLimit,
    aiRemaining: aiLimit == null ? null : Math.max(0, aiLimit - aiUsed),

    reload
  };
}
