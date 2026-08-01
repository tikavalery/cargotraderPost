export function utilPctClass(pct) {
  if (pct >= 85) return 'pct-red';
  if (pct >= 70) return 'pct-yellow';
  return 'pct-green';
}

export function utilBarClass(pct) {
  if (pct >= 85) return 'fill-red';
  if (pct >= 70) return 'fill-yellow';
  return 'fill-green';
}

export function statusBadgeClass(status) {
  if (status === 'Critical Capacity') return 'badge-critical';
  if (status === 'Transit Hub') return 'badge-transit-hub';
  return 'badge-operational';
}

export function storeStatusBadgeClass(status) {
  if (status === 'Open') return 'badge-operational';
  if (status === 'Inactive') return 'badge-transit-hub';
  return 'badge-amber';
}
