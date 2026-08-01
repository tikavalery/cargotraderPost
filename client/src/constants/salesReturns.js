/** Cash and store credit only until Mobile Money / Card are launched. */
export const REFUND_METHODS = ['Cash', 'Store Credit'];

export const RETURN_REASONS = [
  'Wrong size',
  'Defective / damaged',
  'Changed mind',
  'Wrong item',
  'Customer dissatisfaction',
  'Other'
];

export function txnStatusLabel(status) {
  const map = {
    completed: 'Completed',
    partially_returned: 'Partially Returned',
    returned: 'Returned',
    voided: 'Voided',
    pending: 'Pending'
  };
  return map[status] || status || '—';
}

export function txnStatusClass(status) {
  if (status === 'returned') return 'pos-status-returned';
  if (status === 'partially_returned') return 'pos-status-partial';
  if (status === 'voided') return 'pos-status-voided';
  return 'pos-status-completed';
}
