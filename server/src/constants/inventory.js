export {
  CATEGORY_GROUPS,
  INVENTORY_CATEGORIES,
  CATEGORIES,
  CATEGORY_STYLE,
  categoryGroupName,
  categoryPrefix,
  categoryMeta,
  isValidCategory
} from './categories.js';

export function syncItemPricing(data) {
  const qty = Math.max(data.qty || 0, 1);
  if (data.purchasePrice) data.purchaseValue = data.purchasePrice * qty;
  if (data.targetPrice) {
    data.value = data.targetPrice * qty;
    data.priceXaf = data.targetPrice;
  } else if (data.value && qty) {
    data.targetPrice = Math.round(data.value / qty);
    data.priceXaf = data.targetPrice;
  }
  return data;
}
