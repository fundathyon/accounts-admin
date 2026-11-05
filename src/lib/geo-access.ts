import { ISO_COUNTRY_CODES, isIsoCountryCode, joinCountryNames, type CountryI18n } from './countries';
import type { Translate } from './i18n/types';

/**
 * Regional blocking (Pro): which countries can sign in. GET/PUT
 * /api/geo-access, with Accounts' envelope (empty strings and lists are
 * omitted). A 404 means the backend predates the feature.
 *
 * The rule is checked only at sign-in: open sessions keep working and testers
 * are exempt.
 */

export type GeoAccessMode = 'off' | 'allowlist' | 'blocklist';
export type UnknownCountryPolicy = 'allow' | 'deny';

export type GeoAccessConfig = {
  mode: GeoAccessMode;
  countries: string[];
  unknown_country: UnknownCountryPolicy;
};

export const INVALID_GEO_CONFIG_SCOPE = 'app_behaviors.geo_access.invalid_config';

export const defaultGeoAccessConfig: GeoAccessConfig = { mode: 'off', countries: [], unknown_country: 'allow' };

/** Uppercase, no repeats, in the order they came. */
function normalizeCountries(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const c of list) {
    const code = (typeof c === 'string' ? c : '').trim().toUpperCase();
    if (code && !out.includes(code)) out.push(code);
  }
  return out;
}

export function normalizeGeoAccessConfig(raw: unknown): GeoAccessConfig {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const config = r.config && typeof r.config === 'object' ? (r.config as Record<string, unknown>) : {};
  const mode: GeoAccessMode = config.mode === 'allowlist' || config.mode === 'blocklist' ? config.mode : 'off';
  return {
    mode,
    countries: normalizeCountries(config.countries),
    unknown_country: config.unknown_country === 'deny' ? 'deny' : 'allow',
  };
}

/** The PUT body: always the three fields. */
export function toGeoAccessRequest(c: GeoAccessConfig): GeoAccessConfig {
  return { mode: c.mode, countries: normalizeCountries(c.countries), unknown_country: c.unknown_country };
}

export function sameGeoAccessConfig(a: GeoAccessConfig, b: GeoAccessConfig): boolean {
  return JSON.stringify(toGeoAccessRequest(a)) === JSON.stringify(toGeoAccessRequest(b));
}

export type GeoAccessIssue = { field: string; message: string };

/** What prevents saving. */
export function validateGeoAccessConfig(c: GeoAccessConfig, t: Translate): GeoAccessIssue[] {
  const issues: GeoAccessIssue[] = [];
  if (c.mode === 'allowlist' && c.countries.length === 0) {
    issues.push({ field: 'countries', message: t('geoAccess.validation.allowlistEmpty') });
  }
  c.countries.forEach((code, i) => {
    if (!isIsoCountryCode(code)) {
      issues.push({ field: `countries[${i}]`, message: t('geoAccess.validation.invalidCode', { code }) });
    }
  });
  return issues;
}

export type GeoAccessWarning = { tone: 'warning' | 'danger' | 'info'; message: string };

/** What can be saved but is worth knowing. */
export function geoAccessWarnings(c: GeoAccessConfig, t: Translate): GeoAccessWarning[] {
  // An empty allowlist is not a warning: it is a validation error.
  const out: GeoAccessWarning[] = [];
  if (c.mode === 'blocklist' && c.countries.length === 0) {
    out.push({ tone: 'info', message: t('geoAccess.warnings.blocklistEmpty') });
  }
  if (c.mode === 'blocklist' && ISO_COUNTRY_CODES.every((code) => c.countries.includes(code))) {
    out.push({
      tone: 'danger',
      message: c.unknown_country === 'deny' ? t('geoAccess.warnings.blockAllDenyUnknown') : t('geoAccess.warnings.blockAll'),
    });
  }
  if (c.mode !== 'off' && c.unknown_country === 'deny') {
    out.push({ tone: 'warning', message: t('geoAccess.warnings.denyUnknown') });
  }
  return out;
}

/** The sentence that sums up the rule, live. */
export function geoAccessSummary(c: GeoAccessConfig, i18n: CountryI18n): string {
  const { t } = i18n;
  const unknown =
    c.unknown_country === 'deny' ? t('geoAccess.summary.unknownDenied') : t('geoAccess.summary.unknownAllowed');
  if (c.mode === 'off') return t('geoAccess.summary.off');
  if (c.mode === 'allowlist') {
    if (c.countries.length === 0) return t('geoAccess.summary.allowlistEmpty');
    return t('geoAccess.summary.allowlist', { countries: joinCountryNames(c.countries, i18n), unknown });
  }
  if (c.countries.length === 0) return t('geoAccess.summary.blocklistEmpty', { unknown });
  return t('geoAccess.summary.blocklist', { countries: joinCountryNames(c.countries, i18n), unknown });
}

/** A backend field path: `mode`, `countries`, `countries[2]`, `unknown_country`. */
const FIELD_PATH = String.raw`(?:mode|countries|unknown_country)(?:\[\d+\])?`;

/**
 * Splits the 422 message (`"countries[1]: unknown country code; mode: …"`) into
 * fields, like Embedded Auth: it only cuts at `"; "` followed by a path.
 */
export function parseGeoAccessFieldErrors(message: string): GeoAccessIssue[] {
  if (!message) return [];
  const parts = message.split(new RegExp(`;\\s+(?=${FIELD_PATH}: )`));
  const out: GeoAccessIssue[] = [];
  for (const part of parts) {
    const m = new RegExp(`^(${FIELD_PATH}): ([\\s\\S]*)$`).exec(part.trim());
    if (!m) continue;
    out.push({ field: m[1], message: m[2] });
  }
  return out;
}

/** Country presets to start quickly. Label: `geoAccess.presets.<id>`. */
export const COUNTRY_PRESETS: { id: 'mx' | 'na' | 'latam'; countries: string[] }[] = [
  { id: 'mx', countries: ['MX'] },
  { id: 'na', countries: ['MX', 'US', 'CA'] },
  {
    id: 'latam',
    countries: ['AR', 'BO', 'BR', 'CL', 'CO', 'CR', 'CU', 'DO', 'EC', 'GT', 'HN', 'MX', 'NI', 'PA', 'PE', 'PR', 'PY', 'SV', 'UY', 'VE'],
  },
];
