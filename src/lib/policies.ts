import type { Translate } from './i18n/types';

/**
 * Authorization policies and their assignment to roles. A policy is (resource,
 * action, effect), and that triple is unique in the app: a repeat answers 409.
 *
 *   GET/POST     /api/policies
 *   PATCH/DELETE /api/policies/:id
 *   POST         /api/role-policies                    ({role_id, policy_id})
 *   GET          /api/role-policies/:roleId            ({role, policies})
 *   DELETE       /api/role-policies/:roleId/:policyId
 *
 * Evaluation: a matching deny wins; with no match, it is denied.
 */

export type PolicyEffect = 'allow' | 'deny';

export type Policy = {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  effect: PolicyEffect;
};

export type PolicyInput = Omit<Policy, 'id'>;

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function record(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

export function normalizePolicy(raw: unknown): Policy {
  const r = record(raw);
  return {
    id: String(r.id ?? r.policy_id ?? ''),
    name: str(r.name),
    description: str(r.description),
    resource: str(r.resource),
    action: str(r.action),
    effect: r.effect === 'deny' ? 'deny' : 'allow',
  };
}

/** The list of an envelope (`data` is omitted with no rows; GET of a role nests it in `data.policies`). */
export function listFromEnvelope(raw: unknown): unknown[] {
  const data = record(raw).data;
  if (Array.isArray(data)) return data;
  const nested = record(data).policies;
  return Array.isArray(nested) ? nested : [];
}

export function validatePolicy(input: PolicyInput, t: Translate): string | null {
  if (!input.name) return t('policies.nameRequired');
  if (!input.resource) return t('policies.resourceRequired');
  if (!input.action) return t('policies.actionRequired');
  return null;
}

/** "users:read", resource and action together. */
export function policyTarget(p: Pick<Policy, 'resource' | 'action'>): string {
  return `${p.resource || '*'}:${p.action || '*'}`;
}
