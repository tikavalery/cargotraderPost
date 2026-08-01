import { categoryMeta } from '../../theme/inventoryConstants';

export default function PurchaseStatusBadge({ status }) {
  const cls = status === 'saved' ? 'status-ship' : 'status-stored';
  return <span className={`pur-status-pill ${cls}`}>{status || 'draft'}</span>;
}

export function StockStatusBadge({ status }) {
  const map = {
    Stored: 'status-stored',
    'In Store': 'status-store',
    'On Ship': 'status-ship',
    Sold: 'status-sold',
    Returned: 'status-returned'
  };
  return <span className={`status-badge ${map[status] || 'status-stored'}`}>{status}</span>;
}

export { categoryMeta };
