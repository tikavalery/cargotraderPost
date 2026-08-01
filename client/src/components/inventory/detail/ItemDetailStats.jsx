import { formatXaf } from '../../../utils/format';
import { itemPurchasePrice, itemTargetPrice } from '../../../theme/inventoryConstants';
import { usePermissions } from '../../../hooks/usePermissions';

export default function ItemDetailStats({ item }) {
  const { canViewCost } = usePermissions();
  const stats = [
    {
      icon: 'fa-tag',
      tone: 'green',
      label: 'Target Price',
      value: formatXaf(itemTargetPrice(item)),
      sub: 'per unit'
    },
    ...(canViewCost
      ? [{
          icon: 'fa-receipt',
          tone: 'orange',
          label: 'Purchase Price',
          value: formatXaf(itemPurchasePrice(item)),
          sub: 'per unit'
        }]
      : []),
    {
      icon: 'fa-map-marker-alt',
      tone: 'teal',
      label: 'Location',
      value: item.location || '—',
      sub: '—'
    }
  ];

  return (
    <div className="at-detail-stats">
      {stats.map((s) => (
        <div key={s.label} className="at-detail-stat">
          <div className={`at-detail-stat-icon ${s.tone}`}>
            <i className={`fas ${s.icon}`} />
          </div>
          <div>
            <div className="at-detail-stat-label">{s.label}</div>
            <div className="at-detail-stat-value">{s.value}</div>
            {s.sub !== '—' && <div className="at-detail-stat-sub">{s.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
