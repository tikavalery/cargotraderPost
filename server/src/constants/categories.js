/**
 * Exhaustive product categories for import, warehouse, retail & resale operations.
 * Keep in sync with client/src/constants/categories.js
 */

export const CATEGORY_GROUPS = [
  {
    label: 'Apparel & Fashion',
    categories: [
      'Clothes',
      'Shoes',
      'Bags & Luggage',
      'Accessories',
      'Jewelry & Watches',
      'Hats & Caps',
      'Underwear & Lingerie',
      "Children's Clothing",
      'Baby & Kids',
      'Sportswear',
      'Traditional & Cultural Wear'
    ]
  },
  {
    label: 'Electronics',
    categories: [
      'Mobile Phones',
      'Tablets',
      'Computers & Laptops',
      'Audio & Headphones',
      'TVs & Monitors',
      'Home Appliances',
      'Small Electronics',
      'Cameras & Photography',
      'Gaming & Consoles'
    ]
  },
  {
    label: 'Home & Living',
    categories: [
      'Home & Kitchen',
      'Furniture',
      'Bedding & Linens',
      'Bathroom & Personal Care',
      'Cleaning & Household',
      'Lighting'
    ]
  },
  {
    label: 'Beauty & Health',
    categories: [
      'Beauty & Cosmetics',
      'Health & Wellness',
      'Fragrances'
    ]
  },
  {
    label: 'Food & Groceries',
    categories: ['Food & Beverages', 'Groceries & Dry Goods']
  },
  {
    label: 'Automotive & Hardware',
    categories: ['Auto Parts & Accessories', 'Tools & Hardware', 'Building Materials']
  },
  {
    label: 'Office, Leisure & Other',
    categories: [
      'Office & Stationery',
      'Toys & Games',
      'Books & Media',
      'Pet Supplies',
      'Sports & Outdoors',
      'Agriculture & Farm',
      'Textiles & Fabrics',
      'Industrial Equipment',
      'Miscellaneous'
    ]
  }
];

export const INVENTORY_CATEGORIES = CATEGORY_GROUPS.flatMap((g) => g.categories);

/** @deprecated use INVENTORY_CATEGORIES */
export const CATEGORIES = INVENTORY_CATEGORIES;

const GROUP_META = {
  'Apparel & Fashion': { icon: 'fa-tshirt', color: '#E85D26' },
  Electronics: { icon: 'fa-microchip', color: '#27AE60' },
  'Home & Living': { icon: 'fa-couch', color: '#9B59B6' },
  'Beauty & Health': { icon: 'fa-spa', color: '#E91E8C' },
  'Food & Groceries': { icon: 'fa-utensils', color: '#D4880F' },
  'Automotive & Hardware': { icon: 'fa-tools', color: '#5C6BC0' },
  'Office, Leisure & Other': { icon: 'fa-box', color: '#8A97A8' }
};

/** Explicit styles for legacy / high-volume categories */
export const CATEGORY_STYLE = {
  Clothes: { icon: 'fa-tshirt', color: '#E85D26', prefix: 'CLT' },
  Shoes: { icon: 'fa-shoe-prints', color: '#1A3C5E', prefix: 'SHO' },
  'Bags & Luggage': { icon: 'fa-suitcase', color: '#9B59B6', prefix: 'BAG' },
  Accessories: { icon: 'fa-gem', color: '#14B8A6', prefix: 'ACC' },
  Electronics: { icon: 'fa-mobile-alt', color: '#27AE60', prefix: 'ELC' },
  Bags: { icon: 'fa-shopping-bag', color: '#9B59B6', prefix: 'BAG' },
  'Mobile Phones': { icon: 'fa-mobile-alt', color: '#27AE60', prefix: 'MOB' },
  'Home Appliances': { icon: 'fa-blender', color: '#5C6BC0', prefix: 'HAP' },
  Miscellaneous: { icon: 'fa-box-open', color: '#8A97A8', prefix: 'MSC' }
};

export function categoryGroupName(category) {
  for (const group of CATEGORY_GROUPS) {
    if (group.categories.includes(category)) return group.label;
  }
  return 'Office, Leisure & Other';
}

export function categoryPrefix(category) {
  if (CATEGORY_STYLE[category]?.prefix) return CATEGORY_STYLE[category].prefix;
  const letters = String(category || '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase();
  return (letters.slice(0, 3) || 'GEN');
}

export function categoryMeta(category) {
  if (CATEGORY_STYLE[category]) {
    const s = CATEGORY_STYLE[category];
    return { icon: s.icon, color: s.color, prefix: s.prefix || categoryPrefix(category) };
  }
  const group = categoryGroupName(category);
  const gm = GROUP_META[group] || { icon: 'fa-box', color: '#8A97A8' };
  return { icon: gm.icon, color: gm.color, prefix: categoryPrefix(category) };
}

export function isValidCategory(value) {
  return INVENTORY_CATEGORIES.includes(value);
}
