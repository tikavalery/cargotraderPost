import { CURRENCY_OPTIONS } from '../../theme/authConstants';

/** Preferred-currency dropdown for registration. */
export default function CurrencyChipGroup({ value, onChange, id = 'regCurrency' }) {
  return (
    <div className="input-wrap">
      <i className="fas fa-coins input-icon" />
      <select
        id={id}
        className="form-select"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Preferred currency"
      >
        <option value="" disabled>
          Select currency…
        </option>
        {CURRENCY_OPTIONS.map((c) => (
          <option key={c.code} value={c.code}>
            {c.label}
          </option>
        ))}
      </select>
      <i className="fas fa-chevron-down select-arrow" />
    </div>
  );
}
