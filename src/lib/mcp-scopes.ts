import type { Translate } from './i18n/types';

/**
 * The scopes of an MCP server as a document: what is exported, imported and
 * validated before it reaches Accounts. The JSON is exactly the body of
 * `PUT /v1/mcp-resources/{id}/scopes` (and `scopes` in `POST /v1/mcp-resources`),
 * so an export can be sent as is with curl. It validates what Accounts will, so
 * errors show up before sending and per row.
 */

/** The shape Accounts requires of a scope key. */
export const SCOPE_KEY_PATTERN = /^[a-z0-9][a-z0-9:._-]{0,63}$/;

export type ScopeDocumentEntry = {
  key: string;
  label: string;
  description?: string;
  is_write?: boolean;
  is_default?: boolean;
  roles?: string[];
};

export type ScopeDocument = { scopes: ScopeDocumentEntry[] };

/**
 * A form row; `roles` is comma-separated text. `isDefault` has no control but
 * travels with the row: Accounts turns a missing `is_default` into true, so
 * dropping it would change the scope on every save.
 */
export type ScopeDraft = { key: string; label: string; description: string; isWrite: boolean; isDefault: boolean; roles: string };

export const EMPTY_SCOPE: ScopeDraft = { key: '', label: '', description: '', isWrite: false, isDefault: true, roles: '' };

export function splitList(value: string): string[] {
  return value.split(/[\s,]+/).map((v) => v.trim()).filter(Boolean);
}

export function draftsToDocument(drafts: ScopeDraft[]): ScopeDocument {
  return {
    scopes: drafts
      .filter((s) => s.key.trim() || s.label.trim())
      .map((s) => ({
        key: s.key.trim(),
        label: s.label.trim(),
        description: s.description.trim(),
        is_write: s.isWrite,
        is_default: s.isDefault,
        roles: splitList(s.roles),
      })),
  };
}

export function entriesToDrafts(entries: ScopeDocumentEntry[]): ScopeDraft[] {
  return entries.map((e) => ({
    key: e.key,
    label: e.label,
    description: e.description ?? '',
    isWrite: Boolean(e.is_write),
    isDefault: e.is_default ?? true,
    roles: (e.roles ?? []).join(', '),
  }));
}

export function documentToText(doc: ScopeDocument): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

/** A safe file name from the server's name. */
export function exportFileName(resourceName: string): string {
  const slug = resourceName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `mcp-scopes-${slug || 'server'}.json`;
}

export type ParsedScopes = { ok: true; drafts: ScopeDraft[] } | { ok: false; errors: string[] };

/**
 * Reads a pasted or uploaded scopes document: `{ "scopes": [...] }` or a bare
 * array. Returns EVERY error, per row, instead of the first: whoever pastes
 * twenty scopes wants to fix them in one go.
 */
export function parseScopesDocument(text: string, t: Translate): ParsedScopes {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: [t('mcpConnect.scopes.invalidJson')] };
  }
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? (raw as { scopes?: unknown }).scopes : undefined;
  if (!Array.isArray(list)) return { ok: false, errors: [t('mcpConnect.scopes.expectedShape')] };
  if (list.length === 0) return { ok: false, errors: [t('mcpConnect.scopes.empty')] };
  if (list.length > 50) return { ok: false, errors: [t('mcpConnect.scopes.tooMany')] };

  const errors: string[] = [];
  const seen = new Set<string>();
  const drafts: ScopeDraft[] = [];
  list.forEach((entry, index) => {
    const row = index + 1;
    if (!entry || typeof entry !== 'object') {
      errors.push(t('mcpConnect.scopes.notObject', { row }));
      return;
    }
    const e = entry as Record<string, unknown>;
    const key = typeof e.key === 'string' ? e.key.trim() : '';
    const label = typeof e.label === 'string' ? e.label.trim() : '';
    if (!key) errors.push(t('mcpConnect.scopes.missingKey', { row }));
    else if (!SCOPE_KEY_PATTERN.test(key)) errors.push(t('mcpConnect.scopes.invalidKey', { row, key }));
    else if (seen.has(key)) errors.push(t('mcpConnect.scopes.duplicateKey', { row, key }));
    seen.add(key);
    if (!label) errors.push(t('mcpConnect.scopes.missingLabel', { row }));
    if (e.roles !== undefined && (!Array.isArray(e.roles) || e.roles.some((r) => typeof r !== 'string'))) {
      errors.push(t('mcpConnect.scopes.invalidRoles', { row }));
    }
    if (e.is_write !== undefined && typeof e.is_write !== 'boolean') {
      errors.push(t('mcpConnect.scopes.invalidBoolean', { row, field: 'is_write' }));
    }
    if (e.is_default !== undefined && typeof e.is_default !== 'boolean') {
      errors.push(t('mcpConnect.scopes.invalidBoolean', { row, field: 'is_default' }));
    }
    drafts.push({
      key,
      label,
      description: typeof e.description === 'string' ? e.description.trim() : '',
      isWrite: e.is_write === true,
      isDefault: e.is_default !== false,
      roles: Array.isArray(e.roles) ? (e.roles as unknown[]).filter((r): r is string => typeof r === 'string').join(', ') : '',
    });
  });
  return errors.length > 0 ? { ok: false, errors } : { ok: true, drafts };
}
