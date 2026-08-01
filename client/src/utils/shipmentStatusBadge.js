export function shipmentStatusBadgeClass(status) {
  const map = {
    'In Transit': 'badge-transit',
    Delayed: 'badge-delayed',
    Arrived: 'badge-arrived',
    'At Customs': 'badge-customs',
    Delivered: 'badge-delivered',
    Closed: 'badge-closed',
    Offloaded: 'badge-offloaded'
  };
  return map[status] || 'badge-transit';
}

export function docStatusBadgeClass(status) {
  const map = {
    verified: 'badge-verified',
    pending: 'badge-pending-review',
    expiring: 'badge-expiring'
  };
  return map[status] || 'badge-pending-review';
}

export function filterShipments(list, { search, statusChip, statusFilter, carrierFilter } = {}) {
  let rows = [...list];
  const q = (search || '').trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (s) =>
        s.shipmentId?.toLowerCase().includes(q) ||
        s.carrier?.toLowerCase().includes(q) ||
        s.origin?.toLowerCase().includes(q) ||
        s.dest?.toLowerCase().includes(q) ||
        s.container?.toLowerCase().includes(q) ||
        s.trackingNumber?.toLowerCase().includes(q)
    );
  }
  if (statusChip && statusChip !== 'All') {
    if (statusChip === 'Active') rows = rows.filter((s) => s.status === 'In Transit');
    else rows = rows.filter((s) => s.status === statusChip);
  }
  if (statusFilter) rows = rows.filter((s) => s.status === statusFilter);
  if (carrierFilter) rows = rows.filter((s) => s.carrier?.toLowerCase().includes(carrierFilter.toLowerCase()));
  return rows;
}

export function filterDocuments(list, { search, statusChip, typeFilter, shipmentFilter }) {
  let rows = [...list];
  const q = (search || '').trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (d) =>
        d.name?.toLowerCase().includes(q) ||
        d.fileName?.toLowerCase().includes(q) ||
        d.shipmentId?.toLowerCase().includes(q) ||
        d.route?.toLowerCase().includes(q)
    );
  }
  if (statusChip && statusChip !== 'All') {
    const map = { Verified: 'verified', 'Pending Review': 'pending', 'Expiring Soon': 'expiring' };
    const st = map[statusChip] || statusChip.toLowerCase();
    rows = rows.filter((d) => d.status === st);
  }
  if (typeFilter && typeFilter !== 'all') rows = rows.filter((d) => d.type === typeFilter);
  if (shipmentFilter) rows = rows.filter((d) => d.shipmentId === shipmentFilter);
  return rows;
}
