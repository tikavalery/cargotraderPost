import { CURRENCY_OPTIONS } from '../../theme/authConstants';
import { useCurrency } from '../../context/CurrencyContext';

/**
 * Preferred / display currency dropdown.
 * Uses CurrencyContext by default, or controlled value/onChange when provided.
 */
export default function CurrencySelect({
  className = '',
  id = 'app-currency',
  value,
  onChange,
  compact = false,
  ariaLabel = 'Display currency'
}) {
  const ctx = useCurrency();
  const current = value ?? ctx.currency;
  const handleChange = (code) => {
    if (onChange) onChange(code);
    else ctx.setCurrency(code);
  };

  return (
    <select
      id={id}
      className={className || 'form-select'}
      value={current}
      onChange={(e) => handleChange(e.target.value)}
      aria-label={ariaLabel}
    >
      {CURRENCY_OPTIONS.map((c) => (
        <option key={c.code} value={c.code}>
          {compact ? c.code : c.label}
        </option>
      ))}
    </select>
  );
}
