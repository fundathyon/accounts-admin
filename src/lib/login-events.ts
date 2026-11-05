import type { StatusKey } from '@foundathyon/community-ui';
import { UNKNOWN_COUNTRY, countryName } from './countries';
import type { Translate } from './i18n/types';

/**
 * Sign-in history of the app: every sign-in (successful, failed or blocked by
 * the regional rule) and every IP change of a session. GET /api/login-events
 * and /api/login-events/summary forward Accounts' envelope: empty strings are
 * omitted, the total comes in `meta.pagination.total` and `page` is 0-based.
 * Accounts keeps the events for 90 days by default.
 */

export const LOGIN_EVENTS_RETENTION_DAYS = 90;
export const LOGIN_EVENTS_PAGE_SIZE = 20;

export type LoginEventType = 'login_succeeded' | 'login_failed' | 'login_blocked' | 'ip_changed';

const EVENT_TYPES: LoginEventType[] = ['login_succeeded', 'login_failed', 'login_blocked', 'ip_changed'];

export const LOGIN_METHODS = [
  'password',
  'email_password_signup',
  'activation',
  'magic_link',
  'email_code',
  'oauth',
  'native_oauth',
] as const;

const BLOCK_REASONS = ['country_not_allowed', 'unknown_country'];
const FAILURE_REASONS = [
  'bad_password',
  'unknown_account',
  'rate_limited',
  'mfa_failed',
  'oauth_failed',
  'link_invalid',
  'code_invalid',
  'account_not_verified',
];

/** Where the location came from: DB-IP in Accounts' Postgres, Cloudflare's headers or nothing (country XX). */
export type GeoSource = 'database' | 'headers' | 'none';

export const GEO_SOURCES: GeoSource[] = ['database', 'headers', 'none'];

export type LoginEvent = {
  id: string;
  user_id: string;
  session_id: string;
  type: LoginEventType;
  /** Empty on an IP change, which has no method. */
  method: string;
  provider: string;
  ip: string;
  /** ISO alpha-2; "XX" = unknown; empty if it did not come. */
  country_code: string;
  country_name: string;
  region: string;
  city: string;
  user_agent: string;
  device_name: string;
  /** Reason of a blocked or failed sign-in. */
  block_reason: string;
  geo_source: GeoSource | '';
  created_at: string;
};

export const EVENT_TYPE_STATUS: Record<LoginEventType, StatusKey> = {
  login_succeeded: 'healthy',
  login_failed: 'failed',
  login_blocked: 'locked',
  ip_changed: 'syncing',
};

export function eventTypeLabel(t: Translate, type: LoginEventType): string {
  return t(`accessLog.events.type.${type}`);
}

export function eventTypeOptions(t: Translate): { value: string; label: string }[] {
  return EVENT_TYPES.map((value) => ({ value, label: eventTypeLabel(t, value) }));
}

export function methodOptions(t: Translate): { value: string; label: string }[] {
  return LOGIN_METHODS.map((value) => ({ value, label: t(`accessLog.events.method.${value}`) }));
}

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  apple: 'Apple',
  github: 'GitHub',
  microsoft: 'Microsoft',
};

/** "Email y contraseña", "OAuth · Google", "—" with no method. */
export function methodLabel(t: Translate, method: string, provider = ''): string {
  if (!method) return '—';
  const base = (LOGIN_METHODS as readonly string[]).includes(method) ? t(`accessLog.events.method.${method}`) : method;
  if (!provider) return base;
  return `${base} · ${PROVIDER_LABELS[provider.toLowerCase()] ?? provider}`;
}

export function geoSourceText(t: Translate, source: GeoSource): { label: string; detail: string } {
  return {
    label: t(`accessLog.events.geoSource.${source}.label`),
    detail: t(`accessLog.events.geoSource.${source}.detail`),
  };
}

export function geoSourceOptions(t: Translate): { value: string; label: string }[] {
  return GEO_SOURCES.map((value) => ({ value, label: geoSourceText(t, value).label }));
}

/** Why a sign-in was blocked or failed, in words. */
export function blockReasonText(t: Translate, reason: string): { title: string; detail: string } | null {
  if (!reason) return null;
  if (BLOCK_REASONS.includes(reason) || FAILURE_REASONS.includes(reason)) {
    return { title: t(`accessLog.events.reason.${reason}.title`), detail: t(`accessLog.events.reason.${reason}.detail`) };
  }
  return { title: reason, detail: t('accessLog.events.reason.reportedByAccounts') };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export function normalizeLoginEvent(raw: Record<string, unknown>): LoginEvent {
  const type = EVENT_TYPES.find((value) => value === raw.type) ?? 'login_succeeded';
  const source = GEO_SOURCES.find((value) => value === raw.geo_source) ?? '';
  return {
    id: String(raw.id ?? ''),
    user_id: str(raw.user_id),
    session_id: str(raw.session_id),
    type,
    method: str(raw.method),
    provider: str(raw.provider),
    ip: str(raw.ip),
    country_code: str(raw.country_code).toUpperCase(),
    country_name: str(raw.country_name),
    region: str(raw.region),
    city: str(raw.city),
    user_agent: str(raw.user_agent),
    device_name: str(raw.device_name),
    block_reason: str(raw.block_reason),
    geo_source: source,
    created_at: str(raw.created_at),
  };
}

export type CountryStat = {
  country_code: string;
  country_name: string;
  logins: number;
  blocked: number;
  unique_ips: number;
};

export type GeoSourceCounts = Record<GeoSource, number>;

export type LoginEventsSummary = {
  logins: number;
  blocked: number;
  unique_ips: number;
  unique_users: number;
  countries: CountryStat[];
  /** Sign-ins by location source; null if Accounts does not send it. */
  sources: GeoSourceCounts | null;
};

function normalizeSources(v: unknown): GeoSourceCounts | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  return { database: num(r.database), headers: num(r.headers), none: num(r.none) };
}

export function normalizeSummary(raw: unknown): LoginEventsSummary {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const countries = Array.isArray(r.countries) ? r.countries : [];
  return {
    logins: num(r.logins),
    blocked: num(r.blocked),
    unique_ips: num(r.unique_ips),
    unique_users: num(r.unique_users),
    countries: countries
      .filter((c): c is Record<string, unknown> => Boolean(c) && typeof c === 'object')
      .map((c) => ({
        // With no code there is no telling where it came from: it counts as unknown.
        country_code: str(c.country_code).toUpperCase() || UNKNOWN_COUNTRY,
        country_name: str(c.country_name),
        logins: num(c.logins),
        blocked: num(c.blocked),
        unique_ips: num(c.unique_ips),
      })),
    sources: normalizeSources(r.sources),
  };
}

/** The share per location source, without the ones at zero. Empty with no sign-ins. */
export function geoSourceBreakdown(sources: GeoSourceCounts): { source: GeoSource; count: number; percent: string }[] {
  const total = sources.database + sources.headers + sources.none;
  if (total <= 0) return [];
  return GEO_SOURCES.filter((s) => sources[s] > 0).map((s) => {
    const rounded = Math.round((sources[s] / total) * 100);
    return { source: s, count: sources[s], percent: rounded === 0 ? '<1 %' : `${rounded} %` };
  });
}

export const PERIODS = [7, 30, 90] as const;
export type PeriodDays = (typeof PERIODS)[number];

export type Range = { from: string; to: string };

/** RFC 3339 (UTC, no milliseconds) of the last `days` days up to now. */
export function periodRange(days: number, now: Date = new Date()): Range {
  const to = new Date(Math.floor(now.getTime() / 1000) * 1000);
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  return { from: iso(from), to: iso(to) };
}

/** Accounts' answer or why there is none. */
export type LoginEventsFailure = {
  ok: false;
  /** The route does not exist: an Accounts that predates the history. */
  unsupported: boolean;
  message: string;
};

type ListEnvelope = {
  success?: boolean;
  data?: unknown;
  meta?: { pagination?: { total?: unknown } };
  error?: { message?: string; scope?: string } | string;
};

async function getEnvelope(
  url: string,
  secretKey: string,
  fallback: string,
  t: Translate,
): Promise<{ ok: true; json: ListEnvelope } | LoginEventsFailure> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'X-Secret-API-Key': secretKey }, cache: 'no-store' });
  } catch {
    return { ok: false, unsupported: false, message: t('securityScreens.networkError') };
  }
  const json = (await res.json().catch(() => ({}))) as ListEnvelope;
  if (!res.ok || json.success === false) {
    const err = json.error;
    const scope = err && typeof err === 'object' ? str(err.scope) : '';
    const message = (err && typeof err === 'object' ? str(err.message) : str(err)) || `${fallback} (HTTP ${res.status})`;
    // A 404 with Accounts' own scope is a real answer; without one, the route does not exist.
    return { ok: false, unsupported: res.status === 404 && !scope.startsWith('login_events'), message };
  }
  return { ok: true, json };
}

export type LoginEventsQuery = {
  /** 1-based, like the table; the API takes it 0-based. */
  page: number;
  userId: string;
  country: string;
  type: string;
  method: string;
  geoSource: string;
  range: Range;
};

export type LoginEventsResult = { ok: true; rows: LoginEvent[]; total: number } | LoginEventsFailure;

export async function fetchLoginEvents(
  apiUrl: (path: string) => string,
  secretKey: string,
  q: LoginEventsQuery,
  t: Translate,
): Promise<LoginEventsResult> {
  const qs = new URLSearchParams({
    page: String(Math.max(0, q.page - 1)),
    size: String(LOGIN_EVENTS_PAGE_SIZE),
    from: q.range.from,
    to: q.range.to,
  });
  if (q.userId) qs.set('user_id', q.userId);
  if (q.country) qs.set('country', q.country);
  if (q.type) qs.set('type', q.type);
  if (q.method) qs.set('method', q.method);
  if (q.geoSource) qs.set('geo_source', q.geoSource);
  const res = await getEnvelope(apiUrl(`/api/login-events?${qs}`), secretKey, t('accessLog.events.loadFailed'), t);
  if (!res.ok) return res;
  const list = Array.isArray(res.json.data) ? res.json.data : [];
  const rows = list
    .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object')
    .map(normalizeLoginEvent);
  return { ok: true, rows, total: num(res.json.meta?.pagination?.total) || rows.length };
}

export type SummaryResult = { ok: true; summary: LoginEventsSummary } | LoginEventsFailure;

export async function fetchLoginEventsSummary(
  apiUrl: (path: string) => string,
  secretKey: string,
  range: Range,
  t: Translate,
): Promise<SummaryResult> {
  const qs = new URLSearchParams({ from: range.from, to: range.to });
  const res = await getEnvelope(apiUrl(`/api/login-events/summary?${qs}`), secretKey, t('accessLog.events.summaryLoadFailed'), t);
  if (!res.ok) return res;
  return { ok: true, summary: normalizeSummary(res.json.data) };
}

/** "Guadalajara, Jalisco", "Jalisco", "". */
export function placeLabel(e: Pick<LoginEvent, 'city' | 'region'>): string {
  return [e.city, e.region].filter(Boolean).join(', ');
}

/** Country name in the active locale; Accounts' name if the browser has none. */
export function eventCountryName(code: string, fallback: string, locale: string, t: Translate): string {
  const cc = (code || '').toUpperCase();
  if (!cc || cc === UNKNOWN_COUNTRY) return t('accessLog.events.unknownCountry');
  const name = countryName(cc, locale);
  return name === cc && fallback ? fallback : name;
}

export function formatDateTime(d: string, locale: string): string {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatCount(n: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(n);
}
