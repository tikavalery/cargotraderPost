/** Query for individual loose inventory rows (matches listLoose / UI). */
export function inventoryItemLimitQuery(businessId) {
  return {
    business: businessId,
    status: { $ne: 'Returned' },
    qty: { $gt: 0 },
    $or: [{ bale: null }, { bale: { $exists: false } }]
  };
}
