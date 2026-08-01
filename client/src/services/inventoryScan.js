import { inventoryItemsApi } from '../api';

/** Look up a product in inventory by scanned QR / barcode value. */
export async function lookupInventoryByScan(rawCode) {
  const trimmed = String(rawCode || '').trim();
  if (!trimmed) {
    throw new Error('Empty scan code');
  }
  const res = await inventoryItemsApi.scan(trimmed);
  return {
    matchType: res.data.matchType || 'item',
    data: res.data.data
  };
}
