import { useT } from '../../i18n/LanguageContext';

const ACTIVE_CHIPS = ['All', 'Active', 'Delayed', 'At Customs', 'Arrived'];
const COMPLETED_CHIPS = ['All', 'Delivered', 'Offloaded', 'Closed', '2025'];
const DOC_CHIPS = ['All', 'Verified', 'Pending Review', 'Expiring Soon'];

export default function ShipmentFilterChips({ variant = 'active', value, onChange }) {
  const t = useT();
  const chips = variant === 'completed' ? COMPLETED_CHIPS : variant === 'documents' ? DOC_CHIPS : ACTIVE_CHIPS;
  return (
    <div className="filter-chips">
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          className={`filter-chip${value === chip ? ' active' : ''}`}
          onClick={() => onChange(chip)}
        >
          {t(chip)}
        </button>
      ))}
    </div>
  );
}
