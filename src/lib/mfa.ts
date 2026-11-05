import type { Translate } from './i18n/types';

/**
 * Second factor (MFA) of the app: when the authenticator app is asked for and
 * in which sign-in flows. GET/PUT /api/mfa, with Accounts' envelope.
 *
 *   off       never asked.
 *   optional  (default) asked from whoever enabled the authenticator app.
 *   required  everyone must set it up when signing in.
 *
 * `flows` limits where it applies; by default, all five.
 */

export type MfaMode = 'off' | 'optional' | 'required';

export type MfaFlow = 'password' | 'oauth' | 'native' | 'magic_link' | 'email_code';

export type MfaConfig = {
  mode: MfaMode;
  flows: MfaFlow[];
  app_id: string;
  updated_at: string;
};

export const DEFAULT_MFA_MODE: MfaMode = 'optional';

/** Copy: `mfa.modes.<value>.label|description`. */
export const MFA_MODES: { value: MfaMode; recommended?: boolean }[] = [
  { value: 'off' },
  { value: 'optional', recommended: true },
  { value: 'required' },
];

/** Copy: `mfa.flows.<value>.label|description`. */
export const ALL_MFA_FLOWS: MfaFlow[] = ['password', 'oauth', 'native', 'magic_link', 'email_code'];

const MODE_SET = new Set<string>(MFA_MODES.map((m) => m.value));
const FLOW_SET = new Set<string>(ALL_MFA_FLOWS);

/** What the chosen mode does, in one sentence. */
export function mfaSummary(t: Translate, mode: MfaMode, flows: MfaFlow[]): string {
  if (mode === 'off') return t('mfa.summary.off');
  if (flows.length === 0) return t('mfa.summary.noFlows');
  const n =
    flows.length === ALL_MFA_FLOWS.length
      ? t('mfa.summary.allFlows')
      : t('mfa.summary.someFlows', { count: flows.length, total: ALL_MFA_FLOWS.length });
  return mode === 'required' ? t('mfa.summary.required', { flows: n }) : t('mfa.summary.optional', { flows: n });
}

function record(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

/** Same order as ALL_MFA_FLOWS, with no duplicates or unknown flows. */
export function sortFlows(flows: readonly string[]): MfaFlow[] {
  const set = new Set(flows);
  return ALL_MFA_FLOWS.filter((f) => set.has(f));
}

/** Takes the envelope (`{data: {...}}`) or the bare object; with no data, the defaults. */
export function normalizeMfa(raw: unknown): MfaConfig {
  const outer = record(raw);
  const r = 'data' in outer ? record(outer.data) : outer;
  const mode: MfaMode = typeof r.mode === 'string' && MODE_SET.has(r.mode) ? (r.mode as MfaMode) : DEFAULT_MFA_MODE;
  const flows = Array.isArray(r.flows)
    ? sortFlows(r.flows.filter((f): f is string => typeof f === 'string' && FLOW_SET.has(f)))
    : [...ALL_MFA_FLOWS];
  return {
    mode,
    flows,
    app_id: typeof r.app_id === 'string' ? r.app_id : '',
    updated_at: typeof r.updated_at === 'string' ? r.updated_at : '',
  };
}

/** Message for Accounts' 400s (`mfa.invalid_mode`, `mfa.invalid_flow`); empty for any other scope. */
export function mfaErrorMessage(t: Translate, scope: string): string {
  if (scope === 'mfa.invalid_mode') return t('mfa.errors.invalidMode');
  if (scope === 'mfa.invalid_flow') return t('mfa.errors.invalidFlow');
  return '';
}
