import { FLAGS } from '../../utils/countryFlags';

export default function SupplierChip({ supplier }) {
  if (!supplier) {
    return <span className="supplier-chip supplier-chip-empty">No supplier selected</span>;
  }
  return (
    <span className="supplier-chip">
      <span className="dot" />
      {FLAGS[supplier.country] || ''} {supplier.name}
    </span>
  );
}
