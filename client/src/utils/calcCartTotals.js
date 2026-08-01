export function calcCartTotals(lines, discType = 'pct', discVal = 0, promoPct = 0) {
  const subtotal = (lines || []).reduce((s, l) => s + (l.price || 0) * (l.qty || 1), 0);
  let discount =
    discType === 'pct'
      ? Math.round(subtotal * (Number(discVal) || 0) / 100)
      : Math.min(subtotal, Number(discVal) || 0);
  if (promoPct > 0) {
    discount += Math.round((subtotal - discount) * promoPct / 100);
  }
  const total = Math.max(0, subtotal - discount);
  const itemCount = (lines || []).reduce((s, l) => s + (l.qty || 1), 0);
  return { subtotal, discount, tax: 0, total, itemCount };
}

export function calcChange(tendered, total) {
  return Math.max(0, (Number(tendered) || 0) - total);
}
