export const FLAGS = {
  CM: '🇨🇲',
  CN: '🇨🇳',
  AE: '🇦🇪',
  TR: '🇹🇷',
  US: '🇺🇸',
  MA: '🇲🇦'
};

export const COUNTRY_OPTIONS = [
  { code: 'CM', label: 'Cameroon' },
  { code: 'CN', label: 'China' },
  { code: 'AE', label: 'UAE' },
  { code: 'US', label: 'USA' },
  { code: 'TR', label: 'Turkey' },
  { code: 'MA', label: 'Morocco' }
];

export function supplierLabel(s) {
  if (!s) return '';
  const flag = FLAGS[s.country] || '';
  const city = s.city ? ` — ${s.city}` : '';
  return `${flag} ${s.name}${city}`.trim();
}
