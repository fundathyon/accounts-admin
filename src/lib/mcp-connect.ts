import type { Envelope } from './api-envelope';
import { apiError } from './api-envelope';
import type { ScopeDocumentEntry } from './mcp-scopes';

/**
 * MCP Connect: the MCP servers the app lets Claude, ChatGPT and other
 * assistants connect to with the login of its own users. Accounts is the OAuth
 * 2.1 authorization server; the app registers the MCP URL, its connection page
 * and the scopes it offers, and sees and revokes what people approved.
 */

export const DEFAULT_ACCESS_TTL_SECONDS = 3600;
export const MIN_ACCESS_TTL_SECONDS = 300;
export const MAX_ACCESS_TTL_SECONDS = 86400;
export const DEFAULT_REDIRECT_DOMAINS = 'claude.ai, chatgpt.com';

export type VerifyCheck = {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  detail?: string;
  expected?: string;
  found?: string;
};

export type VerifyReport = { verified?: boolean; checks?: VerifyCheck[]; at?: string };

export type McpResource = {
  id: string;
  name: string;
  resource_url: string;
  login_url: string;
  access_ttl_seconds: number;
  cimd_enabled: boolean;
  dcr_enabled: boolean;
  allowed_redirect_domains: string[];
  scopes: ScopeDocumentEntry[];
  issuer: string;
  protected_resource_metadata_url: string;
  verified_at?: string | null;
  verify_report?: VerifyReport | null;
  created_at?: string;
};

export type McpConnection = {
  id: string;
  client: { client_id: string; kind?: string; name?: string };
  user_id: string;
  /** The person, resolved by Accounts. Without it the id is shown. */
  user?: { id: string; email?: string; name?: string; is_test?: boolean };
  scope: string[];
  status: 'active' | 'revoked';
  granted_at?: string;
  last_used_at?: string | null;
  revoked_reason?: string;
};

export type ConnectionStatusFilter = 'all' | 'active' | 'revoked';

const CHECK_NAMES = ['reachable', 'challenge_401', 'metadata_fetched', 'resource_matches', 'authorization_server_matches'];
const REVOKED_REASONS = ['owner', 'user', 'client', 'code_replay', 'refresh_reuse', 'session_revoked'];

export function isCheckName(name: string): boolean {
  return CHECK_NAMES.includes(name);
}

export function isRevokedReason(reason: string): boolean {
  return REVOKED_REASONS.includes(reason);
}

/** The error of a BFF answer: Accounts' own, or the fallback. */
export function errorMessage(json: Envelope | null, fallback: string): string {
  return apiError(json)?.message || fallback;
}

export function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

/** How a connection names its person: the email if Accounts resolved it, else the id. */
export function personLabel(connection: McpConnection): string {
  return connection.user?.email || connection.user?.name || connection.user_id;
}

export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
