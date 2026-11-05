import type { Translate } from './i18n/types';

/**
 * Identity linking (Community and Pro): what happens when someone signs in
 * with an OAuth provider and an email+password user with the same email
 * already exists. GET/PUT /api/identity-linking, with Accounts' envelope.
 *
 *   link_with_proof  (default) joins the existing user only if the provider
 *                    verified the email or the person confirms a code sent to it.
 *   separate         OAuth and email+password are always different users.
 */

export type IdentityLinkingMode = 'link_with_proof' | 'separate';

export type IdentityLinkingConfig = {
  mode: IdentityLinkingMode;
  updated_at: string;
};

export const DEFAULT_IDENTITY_LINKING_MODE: IdentityLinkingMode = 'link_with_proof';

/** Copy: `identityLinking.modes.<value>.label|description`. */
export const IDENTITY_LINKING_MODES: { value: IdentityLinkingMode; recommended?: boolean }[] = [
  { value: 'link_with_proof', recommended: true },
  { value: 'separate' },
];

/** What the chosen mode does, in one sentence. */
export function identityLinkingSummary(t: Translate, mode: IdentityLinkingMode): string {
  return mode === 'separate' ? t('identityLinking.summary.separate') : t('identityLinking.summary.linkWithProof');
}

function record(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

/** Takes the envelope (`{data: {...}}`) or the bare object; with no mode, the default. */
export function normalizeIdentityLinking(raw: unknown): IdentityLinkingConfig {
  const outer = record(raw);
  const r = 'data' in outer ? record(outer.data) : outer;
  return {
    mode: r.mode === 'separate' ? 'separate' : DEFAULT_IDENTITY_LINKING_MODE,
    updated_at: typeof r.updated_at === 'string' ? r.updated_at : '',
  };
}
