/**
 * US/UK digit group separators (commas as thousands separators).
 * Does not rely on Intl locale data — always inserts ",".
 *
 * @example groupDigits(54490600) → "54,490,600"
 */
export function groupDigits(value, { maximumFractionDigits = 0 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';

  const neg = n < 0;
  const abs = Math.abs(n);
  let intStr;
  let fracStr = '';

  if (maximumFractionDigits > 0) {
    const fixed = abs.toFixed(maximumFractionDigits);
    const [intPart, fracPart] = fixed.split('.');
    intStr = intPart;
    const trimmed = (fracPart || '').replace(/0+$/, '');
    if (trimmed) fracStr = `.${trimmed}`;
  } else {
    intStr = String(Math.round(abs));
  }

  const grouped = intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}${grouped}${fracStr}`;
}
