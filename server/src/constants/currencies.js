/**
 * Currencies & countries for French- and English-speaking Africa,
 * plus common trade currencies (USD, EUR, GBP, CNY).
 *
 * XAF_PER_UNIT ≈ how many XAF equal 1 unit of that currency (display FX only).
 */

export const XAF_PER_UNIT = {
  XAF: 1,
  XOF: 1,
  USD: 600,
  EUR: 655,
  GBP: 760,
  CNY: 85,
  // English-speaking Africa
  NGN: 0.4,
  GHS: 40,
  KES: 4.6,
  ZAR: 33,
  TZS: 0.23,
  UGX: 0.16,
  ZMW: 24,
  MWK: 0.35,
  SLE: 0.03,
  LRD: 3,
  GMD: 9,
  NAD: 33,
  BWP: 45,
  SZL: 33,
  LSL: 33,
  SSP: 0.5,
  ETB: 5,
  SDG: 1,
  // French-speaking Africa
  MAD: 60,
  DZD: 4.5,
  TND: 190,
  RWF: 0.45,
  BIF: 0.21,
  CDF: 0.21,
  GNF: 0.07,
  MGA: 0.13,
  MRU: 15,
  DJF: 3.4,
  KMF: 1.3,
  MUR: 13,
  SCR: 45
};

export const CURRENCY_OPTIONS = [
  // CFA & Maghreb / Francophone
  { code: 'XAF', label: '₣ XAF · Central Africa CFA (Cameroon, Gabon, Chad…)' },
  { code: 'XOF', label: 'CFA XOF · West Africa CFA (Senegal, Côte d\'Ivoire…)' },
  { code: 'MAD', label: 'DH MAD · Morocco' },
  { code: 'DZD', label: 'DA DZD · Algeria' },
  { code: 'TND', label: 'DT TND · Tunisia' },
  { code: 'GNF', label: 'FG GNF · Guinea' },
  { code: 'CDF', label: 'FC CDF · DR Congo' },
  { code: 'RWF', label: 'FRw RWF · Rwanda' },
  { code: 'BIF', label: 'FBu BIF · Burundi' },
  { code: 'DJF', label: 'Fdj DJF · Djibouti' },
  { code: 'KMF', label: 'CF KMF · Comoros' },
  { code: 'MGA', label: 'Ar MGA · Madagascar' },
  { code: 'MRU', label: 'UM MRU · Mauritania' },
  { code: 'MUR', label: '₨ MUR · Mauritius' },
  { code: 'SCR', label: '₨ SCR · Seychelles' },
  // Anglophone Africa
  { code: 'NGN', label: '₦ NGN · Nigeria' },
  { code: 'GHS', label: '₵ GHS · Ghana' },
  { code: 'KES', label: 'KSh KES · Kenya' },
  { code: 'ZAR', label: 'R ZAR · South Africa' },
  { code: 'TZS', label: 'TSh TZS · Tanzania' },
  { code: 'UGX', label: 'USh UGX · Uganda' },
  { code: 'ZMW', label: 'ZK ZMW · Zambia' },
  { code: 'MWK', label: 'MK MWK · Malawi' },
  { code: 'SLE', label: 'Le SLE · Sierra Leone' },
  { code: 'LRD', label: '$ LRD · Liberia' },
  { code: 'GMD', label: 'D GMD · Gambia' },
  { code: 'NAD', label: '$ NAD · Namibia' },
  { code: 'BWP', label: 'P BWP · Botswana' },
  { code: 'SZL', label: 'E SZL · Eswatini' },
  { code: 'LSL', label: 'L LSL · Lesotho' },
  { code: 'SSP', label: '£ SSP · South Sudan' },
  { code: 'ETB', label: 'Br ETB · Ethiopia' },
  { code: 'SDG', label: '£ SDG · Sudan' },
  // Trade
  { code: 'USD', label: '$ USD · US Dollar' },
  { code: 'EUR', label: '€ EUR · Euro' },
  { code: 'GBP', label: '£ GBP · British Pound' },
  { code: 'CNY', label: '¥ CNY · Chinese Yuan' }
].sort((a, b) => a.code.localeCompare(b.code));

export const VALID_CURRENCIES = CURRENCY_OPTIONS.map((c) => c.code);

export const CURRENCY_SYMBOLS = {
  XAF: '₣',
  XOF: 'CFA',
  USD: '$',
  EUR: '€',
  GBP: '£',
  CNY: '¥',
  NGN: '₦',
  GHS: '₵',
  KES: 'KSh',
  ZAR: 'R',
  TZS: 'TSh',
  UGX: 'USh',
  ZMW: 'ZK',
  MWK: 'MK',
  SLE: 'Le',
  LRD: '$',
  GMD: 'D',
  NAD: '$',
  BWP: 'P',
  SZL: 'E',
  LSL: 'L',
  SSP: '£',
  ETB: 'Br',
  SDG: '£',
  MAD: 'DH',
  DZD: 'DA',
  TND: 'DT',
  GNF: 'FG',
  CDF: 'FC',
  RWF: 'FRw',
  BIF: 'FBu',
  DJF: 'Fdj',
  KMF: 'CF',
  MGA: 'Ar',
  MRU: 'UM',
  MUR: '₨',
  SCR: '₨'
};

export const COUNTRY_CURRENCY = {
  // Francophone
  Cameroon: 'XAF',
  Chad: 'XAF',
  'Central African Republic': 'XAF',
  'Republic of the Congo': 'XAF',
  Gabon: 'XAF',
  'Equatorial Guinea': 'XAF',
  Senegal: 'XOF',
  "Côte d'Ivoire": 'XOF',
  Benin: 'XOF',
  'Burkina Faso': 'XOF',
  Mali: 'XOF',
  Niger: 'XOF',
  Togo: 'XOF',
  'Guinea-Bissau': 'XOF',
  Guinea: 'GNF',
  'DR Congo': 'CDF',
  Rwanda: 'RWF',
  Burundi: 'BIF',
  Djibouti: 'DJF',
  Comoros: 'KMF',
  Madagascar: 'MGA',
  Mauritania: 'MRU',
  Morocco: 'MAD',
  Algeria: 'DZD',
  Tunisia: 'TND',
  Mauritius: 'MUR',
  Seychelles: 'SCR',
  // Anglophone
  Nigeria: 'NGN',
  Ghana: 'GHS',
  Kenya: 'KES',
  'South Africa': 'ZAR',
  Tanzania: 'TZS',
  Uganda: 'UGX',
  Zambia: 'ZMW',
  Malawi: 'MWK',
  'Sierra Leone': 'SLE',
  Liberia: 'LRD',
  Gambia: 'GMD',
  Namibia: 'NAD',
  Botswana: 'BWP',
  Eswatini: 'SZL',
  Lesotho: 'LSL',
  'South Sudan': 'SSP',
  Ethiopia: 'ETB',
  Sudan: 'SDG'
};

export const SUPPORTED_COUNTRIES = [...Object.keys(COUNTRY_CURRENCY), 'Other'];

export function isValidCurrency(code) {
  return VALID_CURRENCIES.includes(String(code || '').toUpperCase());
}

export function normalizeCurrency(code, fallback = 'XAF') {
  const c = String(code || '').toUpperCase();
  return isValidCurrency(c) ? c : fallback;
}

export function xafPerUnit(currency) {
  return XAF_PER_UNIT[normalizeCurrency(currency)] ?? XAF_PER_UNIT.USD;
}
