import type { ApiError } from './api-envelope';
import type { Translate } from './i18n/types';

/**
 * Session security of the app: how tokens are delivered after an OAuth login,
 * whether the refresh token rotates on each use and whether changing the
 * password closes the other sessions. GET/PUT /api/session-security.
 *
 *   {
 *     "oauth_token_delivery": "query" | "code",
 *     "refresh_rotation": bool,
 *     "revoke_sessions_on_password_change": bool,
 *     "app_id": "…", "updated_at": "…",
 *     "defaults_for_new_apps": { …the same three fields… },
 *     "query_delivery": { "in_use": bool, … }
 *   }
 *
 * `query_delivery.in_use` is true only if the app is on `query` and some login
 * received the tokens that way in the last 30 days. The PUT is partial. Apps
 * that predate the setting keep their old behavior (tokens in the URL, no
 * rotation…); new ones start with `defaults_for_new_apps`, and a value that
 * differs from those is marked "Legacy".
 *
 * 400 `session_security.invalid_field` (unknown field) or
 * `session_security.invalid_value` (value not allowed).
 */

export type TokenDelivery = 'query' | 'code';

export type SessionSecurityValues = {
  oauth_token_delivery: TokenDelivery;
  refresh_rotation: boolean;
  revoke_sessions_on_password_change: boolean;
};

export type SessionSecurityKey = keyof SessionSecurityValues;

export const SESSION_SECURITY_KEYS: SessionSecurityKey[] = [
  'oauth_token_delivery',
  'refresh_rotation',
  'revoke_sessions_on_password_change',
];

export type SessionSecurity = {
  values: SessionSecurityValues;
  /** What a new app starts with; null if Accounts does not report it. */
  defaults: SessionSecurityValues | null;
  /** Whether logins really get tokens in the URL; null if Accounts does not report it. */
  query_delivery_in_use: boolean | null;
};

/** What a new app uses today, in case Accounts does not send `defaults_for_new_apps`. */
export const SECURE_DEFAULTS: SessionSecurityValues = {
  oauth_token_delivery: 'code',
  refresh_rotation: true,
  revoke_sessions_on_password_change: true,
};

/** What Accounts did before this was configurable. */
const LEGACY_VALUES: SessionSecurityValues = {
  oauth_token_delivery: 'query',
  refresh_rotation: false,
  revoke_sessions_on_password_change: false,
};

export function fieldLabel(t: Translate, key: SessionSecurityKey): string {
  return t(`sessionSecurity.fields.${key}`);
}

/** Copy: `sessionSecurity.delivery.<value>.label|description`. */
export const TOKEN_DELIVERY_OPTIONS: TokenDelivery[] = ['code', 'query'];

/** The endpoint client apps exchange the code with. */
export const OAUTH_EXCHANGE_ENDPOINT = 'POST /api/v1/oauth/exchange';

/** Anchor of the migration guide on the screen itself. */
export const MIGRATION_GUIDE_ID = 'guia-migracion-oauth';

function record(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function readValues(raw: unknown, fallback: SessionSecurityValues): SessionSecurityValues {
  const r = record(raw);
  return {
    oauth_token_delivery:
      r.oauth_token_delivery === 'code' || r.oauth_token_delivery === 'query'
        ? r.oauth_token_delivery
        : fallback.oauth_token_delivery,
    refresh_rotation: typeof r.refresh_rotation === 'boolean' ? r.refresh_rotation : fallback.refresh_rotation,
    revoke_sessions_on_password_change:
      typeof r.revoke_sessions_on_password_change === 'boolean'
        ? r.revoke_sessions_on_password_change
        : fallback.revoke_sessions_on_password_change,
  };
}

/** Takes the envelope (`{data: {...}}`) or the bare object. */
export function normalizeSessionSecurity(raw: unknown): SessionSecurity {
  const outer = record(raw);
  const r = 'data' in outer ? record(outer.data) : outer;
  const hasDefaults = r.defaults_for_new_apps && typeof r.defaults_for_new_apps === 'object';
  const inUse = record(r.query_delivery).in_use;
  return {
    values: readValues(r, LEGACY_VALUES),
    defaults: hasDefaults ? readValues(r.defaults_for_new_apps, SECURE_DEFAULTS) : null,
    query_delivery_in_use: typeof inUse === 'boolean' ? inUse : null,
  };
}

/**
 * The legacy settings worth asking to migrate. Query delivery only counts if
 * Accounts does not report usage or the app really uses it: an app that gets
 * no tokens in the URL is not asked to change anything.
 */
export function legacyKeysToMigrate(s: SessionSecurity): SessionSecurityKey[] {
  const keys = legacyKeys(s.values, s.defaults);
  const inUse = s.values.oauth_token_delivery === 'query' && s.query_delivery_in_use === true;
  if (s.query_delivery_in_use !== null && !inUse) return keys.filter((k) => k !== 'oauth_token_delivery');
  return keys;
}

export function changedKeys(saved: SessionSecurityValues, draft: SessionSecurityValues): SessionSecurityKey[] {
  return SESSION_SECURITY_KEYS.filter((k) => saved[k] !== draft[k]);
}

/** PUT body with only what changed. */
export function buildPatch(saved: SessionSecurityValues, draft: SessionSecurityValues): Partial<SessionSecurityValues> {
  return Object.fromEntries(changedKeys(saved, draft).map((key) => [key, draft[key]]));
}

/** The fields that differ from what a new app would have. */
export function legacyKeys(values: SessionSecurityValues, defaults: SessionSecurityValues | null): SessionSecurityKey[] {
  const base = defaults ?? SECURE_DEFAULTS;
  return SESSION_SECURITY_KEYS.filter((k) => values[k] !== base[k]);
}

export function sessionSecurityErrorMessage(t: Translate, err: ApiError | undefined, fallback: string): string {
  const field = record(err?.meta).field;
  const label =
    typeof field === 'string' && (SESSION_SECURITY_KEYS as string[]).includes(field)
      ? fieldLabel(t, field as SessionSecurityKey)
      : typeof field === 'string' && field
        ? field
        : null;
  if (err?.scope === 'session_security.invalid_field') {
    return label ? t('sessionSecurity.errors.unknownField', { label }) : t('sessionSecurity.errors.unknownFields');
  }
  if (err?.scope === 'session_security.invalid_value') {
    return label ? t('sessionSecurity.errors.rejectedValue', { label }) : t('sessionSecurity.errors.rejectedValues');
  }
  return err?.message || fallback;
}
