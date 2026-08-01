import { formatXaf } from '../../../utils/format';
import { itemPurchasePrice, itemTargetPrice } from '../../../theme/inventoryConstants';
import { formatSupplierLabel, resolveSupplierFromList } from '../../../utils/itemDetail';
import { usePermissions } from '../../../hooks/usePermissions';
import { Link } from 'react-router-dom';

const ALL_FIELDS = [
  { label: 'Category', key: 'category' },
  { label: 'Item SKU', key: 'sku' },
  { label: 'Quantity', key: 'qty' },
  { label: 'Location', key: 'location' },
  { label: 'Purchase Price', key: 'purchasePrice', format: 'xaf', costOnly: true },
  { label: 'Target Price', key: 'targetPrice', format: 'xaf' },
  { label: 'Supplier', key: 'supplier', format: 'supplier', costOnly: true },
  { label: 'Date Purchased', key: 'purchaseDate' },
  { label: 'Record ID', key: 'recordId' }
];

function fieldValue(item, field, suppliers) {
  if (field.format === 'xaf') {
    if (field.key === 'purchasePrice') return formatXaf(itemPurchasePrice(item));
    return formatXaf(itemTargetPrice(item));
  }
  if (field.format === 'supplier') {
    const label = formatSupplierLabel(item, suppliers);
    const sup = resolveSupplierFromList(item, suppliers);
    if (sup?.supplierId && label !== '—') {
      return (
        <Link
          to={`/purchasing/all?supplier=${encodeURIComponent(sup.supplierId)}`}
          className="sup-purchase-link"
        >
          {label}
        </Link>
      );
    }
    return label;
  }
  if (field.key === 'recordId') return item.itemId || item.id || item._id || '—';
  const val = item[field.key];
  return val != null && val !== '' ? val : '—';
}

export default function ItemDetailFieldGrid({ item, suppliers }) {
  const { canViewCost } = usePermissions();
  const fields = ALL_FIELDS.filter((f) => !f.costOnly || canViewCost);

  return (
    <div className="at-detail-field-grid">
      {fields.map((field) => (
        <div key={field.label} className="at-detail-field">
          <div className="at-detail-field-label">{field.label}</div>
          <div className="at-detail-field-value">{fieldValue(item, field, suppliers)}</div>
        </div>
      ))}
    </div>
  );
}
