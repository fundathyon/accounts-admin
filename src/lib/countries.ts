import type { Translate } from './i18n/types';

/**
 * Countries by ISO 3166-1 alpha-2 code: flag, localized name and the full list
 * of codes for the pickers. Names come from Intl.DisplayNames (no translation
 * tables of our own); if the browser does not know one, the code is used.
 */

/** The code Accounts gives an IP it could not locate. */
export const UNKNOWN_COUNTRY = 'XX';

/** The 249 officially assigned ISO 3166-1 alpha-2 codes. */
export const ISO_COUNTRY_CODES = [
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS',
  'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN',
  'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE',
  'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF',
  'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM',
  'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM',
  'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC',
  'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK',
  'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA',
  'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG',
  'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
  'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO',
  'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI',
  'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW',
] as const;

const CODE_SET = new Set<string>(ISO_COUNTRY_CODES);

export function isIsoCountryCode(code: string): boolean {
  return CODE_SET.has(code.toUpperCase());
}

/** Active locale and translator: what naming a country takes. */
export type CountryI18n = { locale: string; t: Translate };

const displayNames = new Map<string, Intl.DisplayNames | null>();

function regionNames(locale: string): Intl.DisplayNames | null {
  const cached = displayNames.get(locale);
  if (cached !== undefined) return cached;
  let names: Intl.DisplayNames | null;
  try {
    names = new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    names = null;
  }
  displayNames.set(locale, names);
  return names;
}

/** Emoji flag of an alpha-2 code (🌐 for an invalid or unknown one). */
export function countryFlag(code: string): string {
  const cc = (code || '').toUpperCase();
  if (cc === UNKNOWN_COUNTRY || !/^[A-Z]{2}$/.test(cc)) return '🌐';
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function countryName(code: string, locale: string): string {
  const cc = (code || '').toUpperCase();
  try {
    const name = regionNames(locale)?.of(cc);
    // A code Intl does not know comes back as is: that is not a name.
    if (name && name !== cc) return name;
  } catch {
    // RangeError on a malformed code: falls through to the code itself.
  }
  return cc;
}

export type CountryOption = { code: string; name: string; flag: string };

const allCountries = new Map<string, CountryOption[]>();

/** Every country, sorted by its name in the active locale. */
export function allCountryOptions(locale: string): CountryOption[] {
  const cached = allCountries.get(locale);
  if (cached) return cached;
  const collator = new Intl.Collator(locale, { sensitivity: 'base' });
  const options = ISO_COUNTRY_CODES.map((code) => ({
    code,
    name: countryName(code, locale),
    flag: countryFlag(code),
  })).sort((a, b) => collator.compare(a.name, b.name));
  allCountries.set(locale, options);
  return options;
}

/** To search without accents or case: "Mexico" finds "México". */
export function foldText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** "México", "México y Chile", "México, Chile y Perú", "México, Chile, Perú y 3 países más". */
export function joinCountryNames(codes: string[], { locale, t }: CountryI18n, max = 3): string {
  const names = codes.map((c) => countryName(c, locale));
  if (names.length <= 1) return names[0] ?? '';
  if (names.length <= max) {
    return t('geoAccess.countryList.listAnd', { list: names.slice(0, -1).join(', '), last: names[names.length - 1] });
  }
  const count = names.length - max;
  return t(count === 1 ? 'geoAccess.countryList.listAndMoreOne' : 'geoAccess.countryList.listAndMoreMany', {
    list: names.slice(0, max).join(', '),
    count,
  });
}
