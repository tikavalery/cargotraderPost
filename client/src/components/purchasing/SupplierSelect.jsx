import { Link } from 'react-router-dom';
import SupplierChip from './SupplierChip';
import { supplierLabel } from '../../utils/countryFlags';

export default function SupplierSelect({ suppliers, value, onChange, onAddSupplier }) {
  const selected = suppliers.find((s) => s.supplierId === value || s._id === value);

  return (
    <div className="form-group">
      <label className="form-label">
        Supplier <span className="req">*</span>
      </label>
      <select
        className="form-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select supplier...</option>
        {suppliers.map((s) => (
          <option key={s._id || s.supplierId} value={s.supplierId}>
            {supplierLabel(s)}
          </option>
        ))}
      </select>
      <div className="supplier-row">
        <SupplierChip supplier={selected} />
        <button type="button" className="link-btn" onClick={onAddSupplier}>
          <i className="fas fa-plus" /> Add New Supplier
        </button>
        <Link to="/purchasing/suppliers" className="link-btn">
          <i className="fas fa-address-book" /> Manage Suppliers
        </Link>
      </div>
    </div>
  );
}
