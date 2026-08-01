/**
 * Select-all control for responsive table cards.
 * Hidden on desktop (thead checkbox remains); shown ≤1100px when thead is clipped.
 */
export default function MobileSelectAllBar({
  checked = false,
  indeterminate = false,
  onChange,
  disabled = false,
  label = 'Select all',
  countLabel = '',
  className = ''
}) {
  return (
    <div className={`at-mobile-select-all${className ? ` ${className}` : ''}`}>
      <label className="at-mobile-select-all-label">
        <input
          type="checkbox"
          className="at-mobile-select-all-input"
          checked={checked}
          disabled={disabled}
          ref={(el) => {
            if (el) el.indeterminate = Boolean(indeterminate) && !checked;
          }}
          onChange={onChange}
          aria-label={label}
        />
        <span>{label}</span>
      </label>
      {countLabel ? <span className="at-mobile-select-all-count">{countLabel}</span> : null}
    </div>
  );
}
