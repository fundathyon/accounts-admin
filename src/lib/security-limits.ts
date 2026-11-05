import type { ApiError } from './api-envelope';
import type { Translate } from './i18n/types';

/**
 * Security limits of the app: how many requests, failed attempts and codes are
 * tolerated before slowing down. GET/PUT /api/security-limits, with Accounts'
 * envelope.
 *
 * The response has what the app set (`null` = use the instance's), `effective`
 * (what is in use), `defaults` (the instance's) and `ranges`
 * (`{"rate_limit.ip_max": {min, max}, ...}`). The PUT is partial: sending a
 * field sets it and sending `null` returns it to the instance value.
 *
 * Limits cannot be disabled per app: only whoever operates Accounts can turn
 * them off for the whole instance.
 */

export type LimitSection = 'rate_limit' | 'lockout' | 'api_keys' | 'mfa';

export type ScalarKey =
  | 'rate_limit.ip_max'
  | 'rate_limit.ip_window_sec'
  | 'rate_limit.account_max'
  | 'rate_limit.account_window_sec'
  | 'lockout.threshold'
  | 'lockout.window_sec'
  | 'lockout.reset_sec'
  | 'api_keys.failure_max'
  | 'api_keys.failure_window_sec'
  | 'mfa.token_ttl_sec'
  | 'mfa.max_attempts'
  | 'mfa.failure_max'
  | 'mfa.failure_window_sec';

export const DURATIONS_KEY = 'lockout.durations_sec' as const;
export type DurationsKey = typeof DURATIONS_KEY;
export type FieldKey = ScalarKey | DurationsKey;

/** Value of each field; `null` = not set (or unknown in effective/defaults). */
export type LimitValues = { [K in ScalarKey]: number | null } & { [DURATIONS_KEY]: number[] | null };

export type LimitRange = { min: number; max: number };

export type SecurityLimits = {
  /** What the app set; `null` = the instance's. */
  values: LimitValues;
  effective: LimitValues;
  defaults: LimitValues;
  ranges: Partial<Record<FieldKey, LimitRange>>;
};

export type FieldKind = 'count' | 'seconds';

export type ScalarField = { key: ScalarKey; kind: FieldKind };

export type SectionDef = {
  id: LimitSection;
  fields: ScalarField[];
  /** Account lockout only: the ladder of durations goes after this field. */
  durationsAfter?: ScalarKey;
};

export const MAX_DURATIONS = 5;

export const SECTIONS: SectionDef[] = [
  {
    id: 'rate_limit',
    fields: [
      { key: 'rate_limit.ip_max', kind: 'count' },
      { key: 'rate_limit.ip_window_sec', kind: 'seconds' },
      { key: 'rate_limit.account_max', kind: 'count' },
      { key: 'rate_limit.account_window_sec', kind: 'seconds' },
    ],
  },
  {
    id: 'lockout',
    fields: [
      { key: 'lockout.threshold', kind: 'count' },
      { key: 'lockout.window_sec', kind: 'seconds' },
      { key: 'lockout.reset_sec', kind: 'seconds' },
    ],
    durationsAfter: 'lockout.window_sec',
  },
  {
    id: 'api_keys',
    fields: [
      { key: 'api_keys.failure_max', kind: 'count' },
      { key: 'api_keys.failure_window_sec', kind: 'seconds' },
    ],
  },
  {
    id: 'mfa',
    fields: [
      { key: 'mfa.token_ttl_sec', kind: 'seconds' },
      { key: 'mfa.max_attempts', kind: 'count' },
      { key: 'mfa.failure_max', kind: 'count' },
      { key: 'mfa.failure_window_sec', kind: 'seconds' },
    ],
  },
];

const FIELD_I18N_ID: Record<ScalarKey, string> = {
  'rate_limit.ip_max': 'rateLimitIpMax',
  'rate_limit.ip_window_sec': 'rateLimitIpWindow',
  'rate_limit.account_max': 'rateLimitAccountMax',
  'rate_limit.account_window_sec': 'rateLimitAccountWindow',
  'lockout.threshold': 'lockoutThreshold',
  'lockout.window_sec': 'lockoutWindow',
  'lockout.reset_sec': 'lockoutReset',
  'api_keys.failure_max': 'apiKeysFailureMax',
  'api_keys.failure_window_sec': 'apiKeysFailureWindow',
  'mfa.token_ttl_sec': 'mfaTokenTtl',
  'mfa.max_attempts': 'mfaMaxAttempts',
  'mfa.failure_max': 'mfaFailureMax',
  'mfa.failure_window_sec': 'mfaFailureWindow',
};

export function sectionTitle(t: Translate, id: LimitSection): string {
  return t(`securityLimits.sections.${id}.title`);
}

export function sectionDescription(t: Translate, id: LimitSection): string {
  return t(`securityLimits.sections.${id}.description`);
}

export function scalarLabel(t: Translate, key: ScalarKey): string {
  return t(`securityLimits.fields.${FIELD_I18N_ID[key]}.label`);
}

export function scalarDescription(t: Translate, key: ScalarKey): string {
  return t(`securityLimits.fields.${FIELD_I18N_ID[key]}.description`);
}

export const SCALAR_KEYS: ScalarKey[] = SECTIONS.flatMap((s) => s.fields.map((f) => f.key));
export const FIELD_KEYS: FieldKey[] = [...SCALAR_KEYS, DURATIONS_KEY];

export function fieldKind(key: FieldKey): FieldKind {
  if (key === DURATIONS_KEY) return 'seconds';
  return SECTIONS.flatMap((s) => s.fields).find((f) => f.key === key)?.kind ?? 'count';
}

// Readable seconds

export type TimeUnit = 's' | 'min' | 'h' | 'd';

export const TIME_UNITS: { value: TimeUnit; seconds: number }[] = [
  { value: 's', seconds: 1 },
  { value: 'min', seconds: 60 },
  { value: 'h', seconds: 3600 },
  { value: 'd', seconds: 86400 },
];

export function unitLabel(t: Translate, unit: TimeUnit): string {
  return t(`securityLimits.units.${unit}`);
}

export function unitSeconds(unit: TimeUnit): number {
  return TIME_UNITS.find((u) => u.value === unit)?.seconds ?? 1;
}

/** The largest unit in which the value is a whole number. */
export function bestUnit(seconds: number): TimeUnit {
  if (!Number.isFinite(seconds) || seconds <= 0) return 's';
  for (const u of [...TIME_UNITS].reverse()) {
    if (seconds % u.seconds === 0) return u.value;
  }
  return 's';
}

/** 900 → "15 min", 86400 → "1 day", 90 → "1 min 30 s". */
export function formatSeconds(seconds: number | null | undefined, t: Translate): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  if (seconds === 0) return t('securityLimits.format.seconds', { count: 0 });
  const parts: string[] = [];
  let rest = Math.round(seconds);
  const d = Math.floor(rest / 86400);
  rest -= d * 86400;
  const h = Math.floor(rest / 3600);
  rest -= h * 3600;
  const m = Math.floor(rest / 60);
  rest -= m * 60;
  if (d) parts.push(t(d === 1 ? 'securityLimits.format.daysOne' : 'securityLimits.format.daysMany', { count: d }));
  if (h) parts.push(t('securityLimits.format.hours', { count: h }));
  if (m) parts.push(t('securityLimits.format.minutes', { count: m }));
  if (rest) parts.push(t('securityLimits.format.seconds', { count: rest }));
  return parts.slice(0, 2).join(' ');
}

export function formatValue(kind: FieldKind, value: number | null | undefined, t: Translate): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return kind === 'seconds' ? formatSeconds(value, t) : value.toLocaleString();
}

export function formatDurations(values: number[] | null | undefined, t: Translate): string {
  if (!values || values.length === 0) return '—';
  return values.map((v) => formatSeconds(v, t)).join(' → ');
}

export function rangeText(kind: FieldKind, range: LimitRange | undefined, t: Translate): string {
  if (!range) return '';
  return t('securityLimits.range', { min: formatValue(kind, range.min, t), max: formatValue(kind, range.max, t) });
}

// Normalization

function record(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function emptyValues(): LimitValues {
  return Object.fromEntries(FIELD_KEYS.map((k) => [k, null])) as LimitValues;
}

/** `{rate_limit: {ip_max: 50, ...}, lockout: {...}}` → flat values. */
function readValues(raw: unknown): LimitValues {
  const out = emptyValues();
  const root = record(raw);
  for (const key of SCALAR_KEYS) {
    const [section, field] = key.split('.');
    out[key] = num(record(root[section])[field]);
  }
  const durations = record(root.lockout).durations_sec;
  out[DURATIONS_KEY] = Array.isArray(durations)
    ? durations.filter((d): d is number => typeof d === 'number' && Number.isFinite(d))
    : null;
  return out;
}

function readRanges(raw: unknown): Partial<Record<FieldKey, LimitRange>> {
  const r = record(raw);
  const out: Partial<Record<FieldKey, LimitRange>> = {};
  for (const key of FIELD_KEYS) {
    const v = record(r[key]);
    const min = num(v.min);
    const max = num(v.max);
    if (min !== null && max !== null) out[key] = { min, max };
  }
  return out;
}

/** Takes the envelope (`{data: {...}}`) or the bare object. */
export function normalizeSecurityLimits(raw: unknown): SecurityLimits {
  const outer = record(raw);
  const r = 'data' in outer ? record(outer.data) : outer;
  return {
    values: readValues(r),
    effective: readValues(r.effective),
    defaults: readValues(r.defaults),
    ranges: readRanges(r.ranges),
  };
}

// Draft, validation and PUT

function sameValue(a: number | number[] | null, b: number | number[] | null): boolean {
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  }
  return a === b;
}

export function changedKeys(saved: LimitValues, draft: LimitValues): FieldKey[] {
  return FIELD_KEYS.filter((k) => !sameValue(saved[k], draft[k]));
}

/** PUT body with only what changed; `null` = back to the instance value. */
export function buildPatch(saved: LimitValues, draft: LimitValues): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const key of changedKeys(saved, draft)) {
    const [section, field] = key.split('.');
    out[section] ??= {};
    out[section][field] = draft[key];
  }
  return out;
}

function inRange(v: number, range: LimitRange | undefined) {
  return !range || (v >= range.min && v <= range.max);
}

function checkNumber(kind: FieldKind, v: number, range: LimitRange | undefined, t: Translate): string | null {
  if (!Number.isFinite(v)) return t('securityLimits.validation.enterNumber');
  if (!Number.isInteger(v)) {
    return kind === 'seconds' ? t('securityLimits.validation.wholeSeconds') : t('securityLimits.validation.wholeNumber');
  }
  if (!inRange(v, range)) return t('securityLimits.validation.outOfRange', { range: rangeText(kind, range, t) });
  return null;
}

/** Draft errors by field. What uses the instance value is not validated. */
export function validateDraft(
  draft: LimitValues,
  ranges: Partial<Record<FieldKey, LimitRange>>,
  t: Translate,
): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};
  for (const key of SCALAR_KEYS) {
    const v = draft[key];
    if (v === null) continue;
    const err = checkNumber(fieldKind(key), v, ranges[key], t);
    if (err) errors[key] = err;
  }
  const durations = draft[DURATIONS_KEY];
  if (durations !== null) {
    if (durations.length < 1 || durations.length > MAX_DURATIONS) {
      errors[DURATIONS_KEY] = t('securityLimits.validation.ladderLength', { max: MAX_DURATIONS });
    } else {
      const bad = durations.map((d) => checkNumber('seconds', d, ranges[DURATIONS_KEY], t)).find(Boolean);
      if (bad) errors[DURATIONS_KEY] = bad;
      else if (durations.some((d, i) => i > 0 && d < durations[i - 1])) {
        errors[DURATIONS_KEY] = t('securityLimits.validation.ladderOrder');
      }
    }
  }
  return errors;
}

// Accounts errors

/** `"lockout.durations_sec[2]"` or `"ip_max"` → the field key. */
function fieldFromMeta(field: unknown): FieldKey | null {
  if (typeof field !== 'string' || !field) return null;
  const clean = field.replace(/\[\d+\]$/, '');
  const exact = FIELD_KEYS.find((k) => k === clean);
  if (exact) return exact;
  return FIELD_KEYS.find((k) => k.endsWith(`.${clean}`)) ?? null;
}

/** An Accounts 400 assigned to its field, if possible. */
export function fieldErrorFromApi(err: ApiError | undefined, t: Translate): { field: FieldKey; message: string } | null {
  if (!err) return null;
  const meta = record(err.meta);
  if (err.scope === 'security_limits.out_of_range') {
    const field = fieldFromMeta(meta.field);
    if (!field) return null;
    const min = num(meta.min);
    const max = num(meta.max);
    const range = min !== null && max !== null ? { min, max } : undefined;
    return {
      field,
      message: range
        ? t('securityLimits.api.outOfRangeWithRange', { range: rangeText(fieldKind(field), range, t) })
        : t('securityLimits.api.outOfRange'),
    };
  }
  if (err.scope === 'security_limits.invalid_durations') {
    return { field: DURATIONS_KEY, message: t('securityLimits.api.invalidLadder', { max: MAX_DURATIONS }) };
  }
  return null;
}

/** General message for the 400s that do not go next to a field. */
export function securityLimitsErrorMessage(t: Translate, err: ApiError | undefined, fallback: string): string {
  if (err?.scope === 'security_limits.invalid_field') {
    const field = record(err.meta).field;
    return typeof field === 'string' && field
      ? t('securityLimits.errors.unknownField', { field })
      : t('securityLimits.errors.unknownFields');
  }
  if (err?.scope === 'security_limits.out_of_range') return t('securityLimits.errors.outOfRange');
  if (err?.scope === 'security_limits.invalid_durations') return t('securityLimits.errors.invalidLadder');
  return err?.message || fallback;
}
