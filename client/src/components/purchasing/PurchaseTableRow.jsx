import { Link } from 'react-router-dom';
import ItemPhotoCell from '../inventory/ItemPhotoCell';
import PurchaseStatusBadge from '../inventory/StatusBadge';
import { formatCurrency } from '../../utils/formatCurrency';
import { FLAGS } from '../../utils/countryFlags';
import Td from '../common/Td';

export default function PurchaseTableRow({ purchase, selected, onToggle, onClick }) {
  const id = purchase.selectId || purchase.id;
  const supplier = purchase.supplier;
  const supplierId = supplier?.supplierId || purchase.supplierId;
  const supplierName = supplier?.name || purchase.supplierName;

  return (
    <tr
      data-pur-id={id}
      data-select-id={id}
      className={selected ? 'row-selected' : ''}
      onClick={() => onClick(purchase)}
    >
      <Td label="" hideLabel className="pur-check-col" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(id)}
          aria-label={`Select ${purchase.itemName}`}
        />
      </Td>
      <Td label="Photo" hideLabel className="pur-photo-col">
        <ItemPhotoCell photos={purchase.photos} category={purchase.category} size={32} />
      </Td>
      <Td label="Item Name" className="pur-item-name pur-name-col" title={purchase.itemName}>
        {purchase.itemName}
      </Td>
      <Td label="SKU" className="pur-sku-cell">{purchase.sku || '—'}</Td>
      <Td label="Category">{purchase.category}</Td>
      <Td label="Supplier" onClick={(e) => e.stopPropagation()}>
        {supplierId && supplierName ? (
          <Link
            to={`/purchasing/all?supplier=${encodeURIComponent(supplierId)}`}
            className="sup-purchase-link"
          >
            {FLAGS[supplier?.country || purchase.supplierCountry] || ''} {supplierName}
          </Link>
        ) : (
          '—'
        )}
      </Td>
      <Td label="Qty">{purchase.quantity}</Td>
      <Td label="Location">{purchase.location || '—'}</Td>
      <Td label="Purchase Price" className="value-cell">{formatCurrency(purchase.purchasePrice)}</Td>
      <Td label="Target Price" className="value-cell">{formatCurrency(purchase.targetPrice)}</Td>
      <Td label="Purchased">{purchase.purchaseDate || '—'}</Td>
      <Td label="Record Status">
        <PurchaseStatusBadge status={purchase.status} />
      </Td>
    </tr>
  );
}
