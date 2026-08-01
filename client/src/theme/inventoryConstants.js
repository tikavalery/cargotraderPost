import { categoryPrefix } from '../constants/categories.js';

export {
  CATEGORY_GROUPS,
  INVENTORY_CATEGORIES,
  CATEGORIES,
  CATEGORY_STYLE,
  categoryGroupName,
  categoryPrefix,
  categoryMeta
} from '../constants/categories.js';

export {
  CategorySelectOptions,
  CategoryFilterOptions,
  CategoryFilterOptionsFlat
} from '../components/inventory/CategorySelectOptions.jsx';

export function generateBaleSku(category, existingBales = []) {
  const prefix = categoryPrefix(category);
  const count = existingBales.filter((b) => b.sku?.startsWith(`${prefix}-`)).length + 1;
  return `${prefix}-BALE-${String(count).padStart(3, '0')}`;
}

export function itemPurchasePrice(item) {
  return item.purchasePrice || 0;
}

export function itemTargetPrice(item) {
  return item.targetPrice || item.priceXaf || 0;
}
