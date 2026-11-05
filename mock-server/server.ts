// Mock stand-in for the real accounts Go backend (apis/accounts). Started via
// `make dev-mock` — accounts-admin's Next.js API routes talk to this instead of
// INTERNAL_API_URL pointing at a real backend, so the whole admin UI can be
// exercised locally without the Go service, a database, or real API keys.
//
// Response envelope and per-resource shapes are modeled on the real backend's
// Go structs (Response[T], RoleEntity, UserEntity, etc.) — see mock-server/README.md
// for what was verified against source vs. approximated.
//
// Auth headers (X-API-KEY, X-Admin-API-Key) are accepted but NOT validated — any
// value (or none) succeeds, since there's no real key-issuing flow to check against
// in mock mode. The Next.js proxy layer still enforces "header must be present"
// before a request ever reaches here.

import {
  APP_ID, DEFAULT_EMAIL_THEME, NEW_EMAIL_AUTH_CONFIG, apps, appBehaviors, apiKeys, emailAccessSettings, emailAllowlist, emailBlocklist, emailCatalog, emailCatalogMeta, emailThemes, geoAccessBehavior,
  identityLinkingBehavior, loginEvents, mcpConnections, mcpResources, mcpResourceUrls, mfaBehavior, nextId, oauthAudiences, oauthConfigs, paginate, policies, queryDeliveryUsage,
  rolePolicies, roles, securityLimitsDefaults, securityLimitsMeta, securityLimitsOverrides, securityLimitsRanges, sessionSecurityBehavior,
  sessionSecurityDefaults, tokensBehaviorRow, userMetadataPolicy, users, webhookEvents, webhooks,
} from './data';
import type { EmailCatalogEntry } from './data';
// Embedded Auth mirrors the backend contract with the admin's own client-side
// model (no `@/` alias here: Bun resolves this file's relative imports only).
import {
  checkOrigin, checkRedirect, defaultEmbeddedAuthConfig, intersectStrategies, joinIssues, normalizeEmbeddedAuthConfig,
  normalizeProvider, validateEmbeddedAuthConfig,
} from '../src/lib/embedded-auth';
import type { EmbeddedAuthAccent, EmbeddedAuthConfig, EmbeddedAuthStrategies } from '../src/lib/admin-types';
import { isIsoCountryCode } from '../src/lib/countries';
import { RESERVED_KEYS as RESERVED_METADATA_CLAIMS } from '../src/lib/user-metadata';
import { brandingErrors, compactBranding, type BrandingErrorKey, type EmailBranding } from '../src/lib/email-templates';
import { SESSIONS_DEFAULTS, validateEmailCode, validateMagicLink, validateSessions, type EmailAuthConfig } from '../src/lib/behaviors';
import { TOKENS_LIMITS, type TokensConfig } from '../src/lib/tokens-behavior';

const PORT = Number(process.env.MOCK_PORT || 8099);
// Edition reported by GET /health. Pro by default so `make dev-mock` shows the
// Pro-only screens; MOCK_EDITION=community mimics a Community backend (the
// Pro-only routes are then not registered, exactly like the Go server).
const EDITION = (process.env.MOCK_EDITION ?? '').trim().toLowerCase() === 'community' ? 'community' : 'pro';
const PREFIX = '/accounts'; // matches INTERNAL_API_URL's own "/accounts" path segment

function ok(data: unknown, status = 200, meta?: Record<string, unknown>) {
  return Response.json({ success: true, status_code: status, data, ...(meta ? { meta } : {}) }, { status });
}

function fail(status: number, message: string, scope?: string, meta?: Record<string, unknown>) {
  return Response.json({ success: false, status_code: status, error: { code: status, message, ...(scope ? { scope } : {}), ...(meta ? { meta } : {}) } }, { status });
}

function paginatedResponse(items: unknown[], page: number, size: number, total: number, path: string) {
  const totalPages = Math.ceil(total / size) || 0;
  const base = `http://localhost:${PORT}${PREFIX}${path}`;
  const pagination: Record<string, unknown> = {
    page, size, offset: page * size, total, totalPages,
    this: `${base}?offset=${page * size}&page=${page}&size=${size}`,
  };
  if (page + 1 < totalPages) pagination.next = `${base}?offset=${(page + 1) * size}&page=${page + 1}&size=${size}`;
  if (page > 0) pagination.prev = `${base}?offset=${(page - 1) * size}&page=${page - 1}&size=${size}`;
  return ok(items, 200, { pagination });
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function pageParams(url: URL) {
  const page = Number(url.searchParams.get('page') ?? '0') || 0;
  const size = Number(url.searchParams.get('size') ?? '10') || 10;
  return { page, size };
}

type Handler = (req: Request, params: Record<string, string>, url: URL) => Response | Promise<Response>;
const routes: { method: string; pattern: URLPattern; handler: Handler }[] = [];

function route(method: string, path: string, handler: Handler) {
  routes.push({ method, pattern: new URLPattern({ pathname: PREFIX + path }), handler });
}

// ---- health (public; the admin reads data.edition) ----
route('GET', '/health', () => ok({
  status: 'ok', message: 'Service is online and functioning correctly.', timestamp: Math.floor(Date.now() / 1000),
  environment: 'local', version: 'mock', edition: EDITION,
}));

// ---- roles ----
route('GET', '/api/v1/roles', (_req, _p, url) => {
  const { page, size } = pageParams(url);
  const { slice, total } = paginate(roles, page, size);
  return paginatedResponse(slice, page, size, total, '/api/v1/roles');
});
route('POST', '/api/v1/roles', async (req) => {
  const body = await readBody(req);
  const role = { id: nextId('role'), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), name: body.name ?? '', description: body.description ?? '', app_id: APP_ID, users_count: 0 };
  roles.push(role);
  return ok(role, 201);
});
route('PATCH', '/api/v1/roles/:id', async (req, { id }) => {
  const role = roles.find((r) => r.id === id);
  if (!role) return fail(404, 'Role not found', 'roles.update.not_found');
  Object.assign(role, await readBody(req), { updated_at: new Date().toISOString() });
  return ok(role);
});
route('DELETE', '/api/v1/roles/:id', (_req, { id }) => {
  const idx = roles.findIndex((r) => r.id === id);
  if (idx === -1) return fail(404, 'Role not found', 'roles.delete.not_found');
  const [removed] = roles.splice(idx, 1);
  return ok(removed);
});

// ---- policies ----
route('GET', '/api/v1/policies', (_req, _p, url) => {
  const { page, size } = pageParams(url);
  const { slice, total } = paginate(policies, page, size);
  return paginatedResponse(slice, page, size, total, '/api/v1/policies');
});
function policyExists(target: Record<string, unknown>, exceptId?: string) {
  return policies.some((p) => p.id !== exceptId && p.resource === target.resource && p.action === target.action && p.effect === target.effect);
}
route('POST', '/api/v1/policies', async (req) => {
  const body = await readBody(req);
  if (policyExists(body)) return fail(409, 'a policy with this resource, action and effect already exists', 'policies.create.already_exists');
  const policy = { id: nextId('policy'), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), app_id: APP_ID, ...body };
  policies.push(policy);
  return ok(policy, 201);
});

route('PATCH', '/api/v1/policies/:id', async (req, { id }) => {
  const policy = policies.find((p) => p.id === id);
  if (!policy) return fail(404, 'Policy not found', 'policies.update.not_found');
  const next = { ...policy, ...(await readBody(req)), updated_at: new Date().toISOString() };
  if (policyExists(next, id)) return fail(409, 'a policy with this resource, action and effect already exists', 'policies.update.already_exists');
  Object.assign(policy, next);
  return ok(policy);
});
route('DELETE', '/api/v1/policies/:id', (_req, { id }) => {
  const idx = policies.findIndex((p) => p.id === id);
  if (idx === -1) return fail(404, 'Policy not found', 'policies.delete.not_found');
  const [removed] = policies.splice(idx, 1);
  for (const roleId of Object.keys(rolePolicies)) rolePolicies[roleId] = rolePolicies[roleId]!.filter((p) => p !== id);
  return ok({ ...removed, is_removed: true });
});

// ---- role_policies ----
route('GET', '/api/v1/role_policies/:roleId', (_req, { roleId }) => {
  const role = roles.find((r) => r.id === roleId);
  if (!role) return fail(404, 'Role not found', 'role_policies.info.role_not_found');
  const ids = rolePolicies[roleId] ?? [];
  return ok({ role, policies: policies.filter((p) => ids.includes(p.id as string)) });
});
route('POST', '/api/v1/role_policies', async (req) => {
  const body = await readBody(req);
  const roleId = String(body.role_id ?? '');
  const policyId = String(body.policy_id ?? '');
  rolePolicies[roleId] = [...new Set([...(rolePolicies[roleId] ?? []), policyId])];
  return ok({ role_id: roleId, policy_id: policyId }, 201);
});
route('DELETE', '/api/v1/role_policies/:roleId/:policyId', (_req, { roleId, policyId }) => {
  if (!(rolePolicies[roleId] ?? []).includes(policyId)) return fail(404, 'The role does not have that policy', 'role_policies.remove.not_found');
  rolePolicies[roleId] = rolePolicies[roleId]!.filter((p) => p !== policyId);
  return ok({ role_id: roleId, policy_id: policyId, removed: true });
});

// ---- api-keys ----
route('GET', '/api/v1/api-keys', () => ok(apiKeys.map(({ secret_key: _s, secret_hash: _h, ...rest }) => rest)));
route('POST', '/api/v1/api-keys/generate', async (req) => {
  const body = await readBody(req);
  const id = nextId('key');
  const key = { id, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), name: body.name ?? '', description: body.description ?? '', app_id: APP_ID, key_id: id, prefix: 'sk_test', secret_key: `sk_test_${id}`, publishable_key: `pk_test_${id}`, is_active: true, environment: 'test', scopes: [], last_used_at: null, revoked_at: null };
  apiKeys.push(key);
  return ok(key, 201);
});
route('PATCH', '/api/v1/api-keys/:id/deactivate', (_req, { id }) => {
  const key = apiKeys.find((k) => k.id === id);
  if (!key) return fail(404, 'API key not found', 'api_keys.update.not_found');
  key.is_active = false;
  key.revoked_at = new Date().toISOString();
  return ok(key);
});
route('DELETE', '/api/v1/api-keys/:id', (_req, { id }) => {
  const idx = apiKeys.findIndex((k) => k.id === id);
  if (idx === -1) return fail(404, 'API key not found', 'api_keys.delete.not_found');
  apiKeys.splice(idx, 1);
  return ok(null);
});

// ---- webhooks ----
route('GET', '/api/v1/webhooks', () => ok(webhooks)); // not paginated upstream
route('POST', '/api/v1/webhooks', async (req) => {
  const body = await readBody(req);
  const webhook = { id: nextId('wh'), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), app_id: APP_ID, active: true, retries: 3, events: [], ...body };
  webhooks.push(webhook);
  return ok(webhook, 201);
});
route('GET', '/api/v1/webhooks/events', () => Response.json({ success: true, status_code: 200, data: webhookEvents }));
route('PATCH', '/api/v1/webhooks/:id', async (req, { id }) => {
  const webhook = webhooks.find((w) => w.id === id);
  if (!webhook) return fail(404, 'Webhook not found', 'webhooks.update.not_found');
  Object.assign(webhook, await readBody(req), { updated_at: new Date().toISOString() });
  return ok(webhook);
});
route('DELETE', '/api/v1/webhooks/:id', (_req, { id }) => {
  const idx = webhooks.findIndex((w) => w.id === id);
  if (idx === -1) return fail(404, 'Webhook not found', 'webhooks.delete.not_found');
  const [removed] = webhooks.splice(idx, 1);
  return ok(removed);
});

// ---- apps ---- (note: GET/POST live at /v1/apps, no /api prefix; PATCH lives at /api/v1/apps — matches the real backend's own inconsistency)
route('GET', '/v1/apps', (_req, _p, url) => {
  const { page, size } = pageParams(url);
  const { slice, total } = paginate(apps, page, size);
  return paginatedResponse(slice, page, size, total, '/v1/apps');
});
route('POST', '/v1/apps', async (req) => {
  const body = await readBody(req);
  const id = nextId('app');
  const createdRole = { id: nextId('role'), name: 'default', description: 'Full access role' };
  const nowIso = new Date().toISOString();
  apps.push({ id, created_at: nowIso, updated_at: nowIso, name: body.name ?? 'New App', image: '', root_user_id: nextId('user'), root_email: body.root_email ?? '' });
  const response = {
    id, name: body.name ?? 'New App', root_email: body.root_email ?? '', root_user_id: nextId('user'),
    created_at: nowIso, updated_at: nowIso,
    secret_key: `sk_test_${id}`, publishable_key: `pk_test_${id}`,
    created_role: createdRole,
    activated_behaviors: [{ id: nextId('beh'), behavior_code: 'email_auth', is_active: true }],
  };
  return ok(response, 201);
});
route('PATCH', '/api/v1/apps', async (req) => {
  const target = apps[0];
  if (!target) return fail(404, 'App not found', 'apps.update.not_found');
  Object.assign(target, await readBody(req), { updated_at: new Date().toISOString() });
  return ok(target);
});

// ---- users ----
route('GET', '/api/v1/users', (_req, _p, url) => {
  const { page, size } = pageParams(url);
  const { slice, total } = paginate(users, page, size);
  return paginatedResponse(slice, page, size, total, '/api/v1/users');
});
route('GET', '/api/v1/users/:id', (_req, { id }) => {
  const user = users.find((u) => u.id === id);
  if (!user) return fail(404, 'User not found', 'users.get.not_found');
  return ok(user);
});
route('DELETE', '/api/v1/users/:id', (_req, { id }) => {
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return fail(404, 'User not found', 'users.delete.not_found');
  const [removed] = users.splice(idx, 1);
  return ok(removed);
});
route('PATCH', '/api/v1/users/:id/role', async (req, { id }) => {
  const user = users.find((u) => u.id === id);
  if (!user) return fail(404, 'User not found', 'users.update.not_found');
  const body = await readBody(req);
  user.role_id = body.role;
  user.role_details = roles.find((r) => r.id === body.role) ?? null;
  return ok(user);
});
route('PATCH', '/api/v1/users/:id/metadata', async (req, { id }) => {
  const user = users.find((u) => u.id === id);
  if (!user) return fail(404, 'User not found', 'users.update.not_found');
  user.metadata = await readBody(req);
  return ok(user);
});

// ---- dashboard-stats ----
route('GET', '/api/v1/dashboard-stats', () => ok({
  users: users.length, webhooks: webhooks.length, behaviors: appBehaviors.filter((b) => b.is_active).length,
  api_keys: apiKeys.length, roles: roles.length, oauth_configs: oauthConfigs.length,
}));

// ---- oauth-configs ----
route('GET', '/api/v1/oauth-configs', () => ok(oauthConfigs)); // not paginated upstream
route('POST', '/api/v1/oauth-configs', async (req) => {
  const body = await readBody(req);
  const config = { id: nextId('oauth'), app_id: APP_ID, enabled: true, redirects: [], ...body };
  oauthConfigs.push(config);
  oauthAudiences[config.id] = [];
  return ok(config, 201);
});
for (const method of ['PATCH', 'PUT']) {
  route(method, '/api/v1/oauth-configs/:id', async (req, { id }) => {
    const config = oauthConfigs.find((c) => c.id === id);
    if (!config) return fail(404, 'OAuth config not found', 'oauth_configs.update.not_found');
    Object.assign(config, await readBody(req));
    return ok(config);
  });
}
route('DELETE', '/api/v1/oauth-configs/:id', (_req, { id }) => {
  const idx = oauthConfigs.findIndex((c) => c.id === id);
  if (idx === -1) return fail(404, 'OAuth config not found', 'oauth_configs.delete.not_found');
  const [removed] = oauthConfigs.splice(idx, 1);
  return ok(removed);
});
route('POST', '/api/v1/oauth-configs/:id/disable', (_req, { id }) => {
  const config = oauthConfigs.find((c) => c.id === id);
  if (!config) return fail(404, 'OAuth config not found', 'oauth_configs.update.not_found');
  config.enabled = false;
  return ok(config);
});
route('GET', '/api/v1/oauth-configs/:id/redirects', (_req, { id }) => {
  const config = oauthConfigs.find((c) => c.id === id);
  if (!config) return fail(404, 'OAuth config not found', 'oauth_configs.get.not_found');
  return ok([config.redirect_uri_web, config.redirect_uri_android, config.redirect_uri_ios, config.redirect_uri_desktop].filter(Boolean));
});
route('GET', '/api/v1/oauth-configs/:id/audiences', (_req, { id }) => ok(oauthAudiences[id] ?? []));
route('POST', '/api/v1/oauth-configs/:id/audiences', async (req, { id }) => {
  const body = await readBody(req);
  const audience = { id: nextId('aud'), oauth_config_id: id, app_id: APP_ID, created_at: new Date().toISOString(), ...body };
  oauthAudiences[id] = [...(oauthAudiences[id] ?? []), audience];
  return ok(audience, 201);
});
route('DELETE', '/api/v1/oauth-configs/:id/audiences/:audienceId', (_req, { id, audienceId }) => {
  const list = oauthAudiences[id] ?? [];
  const idx = list.findIndex((a) => a.id === audienceId);
  if (idx === -1) return fail(404, 'Audience not found', 'oauth_audiences.delete.not_found');
  list.splice(idx, 1);
  return new Response(null, { status: 204 });
});
route('POST', '/api/v1/oauth-configs/migration/legacy-redirects-apply', () => ok({ migrated: 0 }));
route('GET', '/api/v1/oauth-configs/migration/legacy-redirects-status', () => ok({ pending: 0, migrated: 0 }));

// ---- embedded-auth (Pro) ----
// Registered BEFORE the generic /app-behaviors/:id routes, which would
// otherwise capture "/embedded-auth" (that is what a Community backend does:
// a JSON 404 from the generic route).
const EMBEDDED_AUTH_CODE = 'embedded_auth';

/** What the app can enable (persistence EmbeddedAuthAvailability). */
function embeddedAuthAvailability(): EmbeddedAuthStrategies {
  const emailAuth = appBehaviors.find((b) => b.behavior_code === 'email_auth' && b.is_active === true && b.is_removed !== true);
  const config = (emailAuth?.config ?? {}) as Record<string, unknown>;
  const nodeEnabled = (key: string) => (config[key] as { enabled?: unknown } | undefined)?.enabled === true;
  const oauth = [...new Set(oauthConfigs.filter((c) => c.enabled === true).map((c) => normalizeProvider(String(c.provider ?? ''))))]
    .filter(Boolean)
    .sort();
  return {
    password: !!emailAuth,
    email_code: !!emailAuth && nodeEnabled('email_code'),
    magic_link: !!emailAuth && nodeEnabled('magic_link'),
    oauth,
  };
}

/**
 * The PUT body as the Go DTO decodes it, for Validate: unlike
 * normalizeEmbeddedAuthConfig it keeps an unknown theme / layout / locale and
 * a malformed accent, so they are rejected with the backend's 422 instead of
 * being silently replaced. Empty or missing values are the defaults, as in Go.
 */
function embeddedAuthPutConfig(body: Record<string, unknown>): EmbeddedAuthConfig {
  const config = normalizeEmbeddedAuthConfig(body);
  const raw = (body.branding && typeof body.branding === 'object' ? body.branding : {}) as Record<string, unknown>;
  const keep = <T extends string>(value: unknown, fallback: T): T => (typeof value === 'string' && value !== '' ? (value as T) : fallback);
  const accent = raw.accent;
  const neutral = typeof accent === 'string' && accent.trim().toLowerCase() === 'neutral';
  return {
    ...config,
    branding: {
      ...config.branding,
      theme: keep(raw.theme, config.branding.theme),
      layout: keep(raw.layout, config.branding.layout),
      locale: keep(raw.locale, config.branding.locale),
      accent: accent === undefined || accent === null || neutral ? config.branding.accent : (accent as EmbeddedAuthAccent),
    },
  };
}

/** Canonical stored form (embeddedauth.Settings.Node): normalized and de-duplicated. */
function canonicalEmbeddedAuthConfig(c: EmbeddedAuthConfig): EmbeddedAuthConfig {
  const origins: string[] = [];
  for (const raw of c.allowed_origins) {
    const res = checkOrigin(raw);
    if ('origin' in res && !origins.includes(res.origin)) origins.push(res.origin);
  }
  const redirects: string[] = [];
  for (const raw of c.redirect_urls) {
    const res = checkRedirect(raw);
    if ('redirect' in res && origins.includes(res.origin) && !redirects.includes(res.redirect)) redirects.push(res.redirect);
  }
  const oauth = [...new Set(c.strategies.oauth.map(normalizeProvider))];
  return {
    ...c,
    allowed_origins: origins,
    redirect_urls: redirects,
    strategies: { ...c.strategies, oauth },
    branding: { ...c.branding, name: c.branding.name.trim(), logo_url: c.branding.logo_url.trim() },
  };
}

/** GET/PUT response: stored config (defaults without a row), effective and available. */
function describeEmbeddedAuth() {
  const available = embeddedAuthAvailability();
  const row = appBehaviors.find((b) => b.behavior_code === EMBEDDED_AUTH_CODE);
  const config = row ? normalizeEmbeddedAuthConfig(row.config) : defaultEmbeddedAuthConfig();
  const enabled = !!row && row.is_active === true && config.allowed_origins.some((o) => 'origin' in checkOrigin(o));
  return {
    ...(row ? { id: row.id } : {}),
    app_id: APP_ID,
    config,
    effective: { enabled, strategies: intersectStrategies(config.strategies, available) },
    available,
    ...(row ? { created_at: row.created_at, updated_at: row.updated_at } : {}),
  };
}

if (EDITION === 'pro') {
  // An app that went through the screen once: the row exists, with no origin
  // yet, so the behavior shows in the lists and stays disabled.
  appBehaviors.push({
    id: 'beh_8103', app_id: APP_ID, behavior_code: EMBEDDED_AUTH_CODE, is_active: true,
    config: canonicalEmbeddedAuthConfig(defaultEmbeddedAuthConfig()),
    created_by: APP_ID, created_at: '2026-10-05T09:00:00Z', updated_at: '2026-10-05T09:00:00Z',
  });
  route('GET', '/api/v1/app-behaviors/embedded-auth', () => ok(describeEmbeddedAuth()));
  route('PUT', '/api/v1/app-behaviors/embedded-auth', async (req) => {
    const body = await readBody(req);
    const issues = validateEmbeddedAuthConfig(embeddedAuthPutConfig(body), embeddedAuthAvailability());
    if (issues.length > 0) return fail(422, joinIssues(issues), 'app_behaviors.embedded_auth.invalid_config');
    const stored = canonicalEmbeddedAuthConfig(normalizeEmbeddedAuthConfig(body));
    const now = new Date().toISOString();
    const row = appBehaviors.find((b) => b.behavior_code === EMBEDDED_AUTH_CODE);
    if (row) Object.assign(row, { config: stored, is_active: true, updated_at: now });
    else {
      appBehaviors.push({
        id: nextId('beh'), app_id: APP_ID, behavior_code: EMBEDDED_AUTH_CODE, is_active: true, config: stored,
        created_by: 'system', created_at: now, updated_at: now,
      });
    }
    return ok(describeEmbeddedAuth());
  });
}

// ---- ui (Pro): the Embedded Auth bundle, only when MOCK_UI_DIR points at a build ----
// e.g. MOCK_UI_DIR=../accounts/internal/ui/static make dev-mock → the admin's
// live preview renders the real component. Unset: 404, like a backend without it.
const MOCK_UI_DIR = process.env.MOCK_UI_DIR?.trim() ?? '';
const UI_TYPES: Record<string, string> = {
  js: 'application/javascript; charset=utf-8',
  html: 'text/html; charset=utf-8',
  json: 'application/json',
};
if (EDITION === 'pro' && MOCK_UI_DIR) {
  route('GET', '/ui/v1/:file', async (_req, { file }) => {
    const ext = /^[a-z0-9.-]+\.(js|html|json)$/.exec(file)?.[1];
    const asset = ext ? Bun.file(`${MOCK_UI_DIR.replace(/\/+$/, '')}/${file}`) : null;
    if (!ext || !asset || !(await asset.exists())) return new Response('404 page not found', { status: 404 });
    return new Response(asset, { headers: { 'Content-Type': UI_TYPES[ext], 'X-Content-Type-Options': 'nosniff' } });
  });
}

// ---- security behaviors ----
// Registered BEFORE the generic /app-behaviors/:id routes, for the same reason
// as Embedded Auth. MFA, session security, limits and identity linking exist in
// both editions; geo access only in Pro (in Community it falls into /:id: 404).
const MFA_MODES = ['off', 'optional', 'required'];
const MFA_FLOWS = ['password', 'oauth', 'native', 'magic_link', 'email_code'];

function describeMfa() {
  return { app_id: APP_ID, ...mfaBehavior };
}

route('GET', '/api/v1/app-behaviors/mfa', () => ok(describeMfa()));
route('PUT', '/api/v1/app-behaviors/mfa', async (req) => {
  const body = await readBody(req);
  if (typeof body.mode !== 'string' || !MFA_MODES.includes(body.mode)) {
    return fail(400, 'mode must be "off", "optional" or "required"', 'mfa.invalid_mode');
  }
  const flows = (body.flows ?? MFA_FLOWS) as unknown[];
  if (!Array.isArray(flows) || flows.some((f) => typeof f !== 'string' || !MFA_FLOWS.includes(f))) {
    return fail(400, 'flows must only contain "password", "oauth", "native", "magic_link" or "email_code"', 'mfa.invalid_flow');
  }
  Object.assign(mfaBehavior, { mode: body.mode, flows: MFA_FLOWS.filter((f) => flows.includes(f)), updated_at: new Date().toISOString() });
  return ok(describeMfa());
});

function describeIdentityLinking() {
  return { app_id: APP_ID, ...identityLinkingBehavior };
}

route('GET', '/api/v1/app-behaviors/identity-linking', () => ok(describeIdentityLinking()));
route('PUT', '/api/v1/app-behaviors/identity-linking', async (req) => {
  const { mode } = await readBody(req);
  if (mode !== 'link_with_proof' && mode !== 'separate') {
    return fail(400, 'mode must be "link_with_proof" or "separate"', 'identity_linking.invalid_mode');
  }
  Object.assign(identityLinkingBehavior, { mode, updated_at: new Date().toISOString() });
  return ok(describeIdentityLinking());
});

function describeSessionSecurity() {
  return {
    app_id: APP_ID,
    ...sessionSecurityBehavior,
    defaults_for_new_apps: sessionSecurityDefaults,
    query_delivery: { in_use: sessionSecurityBehavior.oauth_token_delivery === 'query', ...queryDeliveryUsage },
    migration_guide_url: 'https://docs.foundathyon.com/accounts/oauth-code-delivery',
  };
}

route('GET', '/api/v1/app-behaviors/session-security', () => ok(describeSessionSecurity()));
route('PUT', '/api/v1/app-behaviors/session-security', async (req) => {
  const body = await readBody(req);
  const keys = Object.keys(body).sort();
  for (const key of keys) {
    if (!(key in sessionSecurityDefaults)) {
      return fail(400, `unknown field ${key}`, 'session_security.invalid_field', { field: key });
    }
    const value = body[key];
    const valid = key === 'oauth_token_delivery' ? value === 'query' || value === 'code' : typeof value === 'boolean';
    if (!valid) return fail(400, `invalid value for ${key}`, 'session_security.invalid_value', { field: key });
  }
  if (keys.length > 0) Object.assign(sessionSecurityBehavior, body, { updated_at: new Date().toISOString() });
  return ok(describeSessionSecurity());
});

type LimitSections = Record<string, Record<string, unknown>>;

function effectiveLimits() {
  const defaults = securityLimitsDefaults as unknown as LimitSections;
  const out: LimitSections = {};
  for (const section of Object.keys(defaults)) {
    out[section] = { ...defaults[section] };
    for (const [field, value] of Object.entries(securityLimitsOverrides[section])) if (value !== null) out[section][field] = value;
  }
  return out;
}

function describeSecurityLimits() {
  return {
    app_id: APP_ID,
    ...securityLimitsOverrides,
    ...securityLimitsMeta,
    effective: effectiveLimits(),
    defaults: securityLimitsDefaults,
    ranges: securityLimitsRanges,
  };
}

/** Mirrors securitylimits.ParsePatch: the first problem found answers the 400. */
function limitsPatchError(body: Record<string, unknown>) {
  for (const [section, fields] of Object.entries(body)) {
    if (!fields || typeof fields !== 'object') {
      return fail(400, `unknown field ${section}`, 'security_limits.invalid_field', { field: section });
    }
    for (const [field, value] of Object.entries(fields)) {
      const path = `${section}.${field}`;
      const range = securityLimitsRanges[path];
      if (!range) return fail(400, `unknown field ${path}`, 'security_limits.invalid_field', { field: path });
      if (value === null) continue;
      if (path === 'lockout.durations_sec') {
        const list = value as number[];
        if (!Array.isArray(list) || list.length < 1 || list.length > 5) {
          return fail(400, `${path} must have between 1 and 5 values`, 'security_limits.invalid_durations', { field: path, min_items: 1, max_items: 5 });
        }
        for (const [index, d] of list.entries()) {
          if (!Number.isInteger(d) || d < range.min || d > range.max) {
            return fail(400, `${path} is out of range`, 'security_limits.out_of_range', { field: path, min: range.min, max: range.max, index });
          }
          if (index > 0 && d < list[index - 1]) {
            return fail(400, `${path} must not decrease`, 'security_limits.invalid_durations', { field: path, index });
          }
        }
      } else if (!Number.isInteger(value) || (value as number) < range.min || (value as number) > range.max) {
        return fail(400, `${path} is out of range`, 'security_limits.out_of_range', { field: path, min: range.min, max: range.max });
      }
    }
  }
  return null;
}

route('GET', '/api/v1/app-behaviors/security-limits', () => ok(describeSecurityLimits()));
route('PUT', '/api/v1/app-behaviors/security-limits', async (req) => {
  const body = await readBody(req);
  const problem = limitsPatchError(body);
  if (problem) return problem;
  for (const [section, fields] of Object.entries(body)) Object.assign(securityLimitsOverrides[section], fields);
  if (Object.keys(body).length > 0) securityLimitsMeta.updated_at = new Date().toISOString();
  return ok(describeSecurityLimits());
});

if (EDITION === 'pro') {
  const describeGeoAccess = () => ({ app_id: APP_ID, ...geoAccessBehavior });

  route('GET', '/api/v1/app-behaviors/geo-access', () => ok(describeGeoAccess()));
  route('PUT', '/api/v1/app-behaviors/geo-access', async (req) => {
    const body = await readBody(req);
    const mode = String(body.mode ?? '').trim().toLowerCase();
    const unknownCountry = String(body.unknown_country ?? '').trim().toLowerCase() || 'allow';
    const raw = Array.isArray(body.countries) ? (body.countries as unknown[]) : [];
    // Canonical form of geoaccess.Settings.Normalize: uppercase, unique, sorted.
    const countries = [...new Set(raw.map((c) => String(c).trim().toUpperCase()))].sort();
    const issues: string[] = [];
    if (!['off', 'allowlist', 'blocklist'].includes(mode)) issues.push('mode: must be "off", "allowlist" or "blocklist"');
    if (unknownCountry !== 'allow' && unknownCountry !== 'deny') issues.push('unknown_country: must be "allow" or "deny"');
    if (mode === 'allowlist' && countries.length === 0) issues.push('countries: must have at least one country when mode is allowlist');
    countries.forEach((c, i) => {
      if (!isIsoCountryCode(c) && c !== 'XK') issues.push(`countries[${i}]: "${c}" is not an ISO 3166-1 alpha-2 country code`);
    });
    if (issues.length > 0) return fail(422, issues.join('; '), 'app_behaviors.geo_access.invalid_config');
    Object.assign(geoAccessBehavior, { config: { mode, countries, unknown_country: unknownCountry }, updated_at: new Date().toISOString() });
    return ok(describeGeoAccess());
  });
}

// ---- email locale (both editions) ----
// Registered BEFORE the generic /app-behaviors/:id routes, like the others.
const LOCALE_SHAPE = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/;

function describeEmailLocale() {
  const row = appBehaviors.find((b) => b.behavior_code === 'email_locale');
  const stored = row?.is_active === true ? String((row.config as { default_locale?: unknown }).default_locale ?? '') : '';
  return {
    app_id: APP_ID,
    default_locale: stored,
    effective_default_locale: stored || 'en',
    ...(row ? { updated_at: row.updated_at } : {}),
  };
}

route('GET', '/api/v1/app-behaviors/email-locale', () => ok(describeEmailLocale()));
route('PUT', '/api/v1/app-behaviors/email-locale', async (req) => {
  const body = await readBody(req);
  const raw = String(body.default_locale ?? '').trim();
  const locale = raw.toLowerCase().replaceAll('_', '-');
  if (raw && (locale.length > 35 || !LOCALE_SHAPE.test(locale))) {
    return fail(400, 'default_locale must be a BCP 47 language tag such as "es" or "es-MX", or empty', 'email_locale.invalid_locale');
  }
  const now = new Date().toISOString();
  const row = appBehaviors.find((b) => b.behavior_code === 'email_locale');
  if (row) Object.assign(row, { config: { default_locale: locale }, is_active: true, updated_at: now });
  else {
    appBehaviors.push({
      id: nextId('beh'), app_id: APP_ID, behavior_code: 'email_locale', is_active: true, config: { default_locale: locale },
      created_by: APP_ID, created_at: now, updated_at: now,
    });
  }
  return ok(describeEmailLocale());
});

// ---- tokens (Pro): in Community the path falls into /:id and answers 404 ----
// What an app inherits from JWT_EXPIRE / REFRESH_EXPIRE.
const INHERITED_ACCESS_SECONDS = 900;
const INHERITED_REFRESH_SECONDS = 30 * 86400;
const SHORT_TOKEN_SECONDS = 900;

function describeTokens() {
  const config = tokensBehaviorRow.config as TokensConfig;
  const { lifetimes } = config;
  const effective: TokensConfig = {
    ...config,
    lifetimes: {
      access_token_seconds: lifetimes.access_token_seconds || INHERITED_ACCESS_SECONDS,
      refresh_token_seconds: lifetimes.refresh_token_seconds || INHERITED_REFRESH_SECONDS,
      activation_token_seconds: lifetimes.activation_token_seconds || SHORT_TOKEN_SECONDS,
      password_reset_token_seconds: lifetimes.password_reset_token_seconds || SHORT_TOKEN_SECONDS,
    },
    sessions: { ...config.sessions },
    revocation: { ...config.revocation },
  };
  // withSessionSecurityMinimum: session_security is also part of what applies.
  if (sessionSecurityBehavior.refresh_rotation) effective.sessions.refresh_rotation = true;
  if (sessionSecurityBehavior.revoke_sessions_on_password_change) {
    if (effective.revocation.on_password_change === 'none') effective.revocation.on_password_change = 'others';
    effective.revocation.on_password_reset = 'all';
  }
  const { id, created_at, updated_at } = tokensBehaviorRow;
  return { id, app_id: APP_ID, config, effective, created_at, updated_at };
}

/** `Settings.Validate`. */
function tokensIssues(c: TokensConfig): string[] {
  const issues: string[] = [];
  const range = (field: string, value: number, { min, max }: { min: number; max: number }) => {
    if (value !== 0 && (value < min || value > max)) issues.push(`${field}: must be 0 (inherit) or between ${min} and ${max} seconds`);
  };
  const { lifetimes: l, sessions: s, limits, revocation: r } = c;
  range('lifetimes.access_token_seconds', l.access_token_seconds, TOKENS_LIMITS.access);
  range('lifetimes.refresh_token_seconds', l.refresh_token_seconds, TOKENS_LIMITS.refresh);
  range('lifetimes.activation_token_seconds', l.activation_token_seconds, TOKENS_LIMITS.activation);
  range('lifetimes.password_reset_token_seconds', l.password_reset_token_seconds, TOKENS_LIMITS.reset);
  const access = l.access_token_seconds || INHERITED_ACCESS_SECONDS;
  const refresh = l.refresh_token_seconds || INHERITED_REFRESH_SECONDS;
  if (refresh <= access) {
    issues.push(`lifetimes.refresh_token_seconds: the session (${refresh} s) must last longer than the access token (${access} s)`);
  }
  if (s.reuse_interval_seconds < 0 || s.reuse_interval_seconds > TOKENS_LIMITS.reuseMax) {
    issues.push(`sessions.reuse_interval_seconds: must be between 0 and ${TOKENS_LIMITS.reuseMax} seconds`);
  }
  const idle = s.idle_timeout_seconds;
  if (idle !== 0) {
    const minIdle = Math.max(TOKENS_LIMITS.idle.min, 2 * access);
    if (idle < minIdle) issues.push(`sessions.idle_timeout_seconds: must be 0 or at least ${minIdle} seconds: twice the access token lifetime, and never under one hour`);
    else if (idle > TOKENS_LIMITS.idle.max) issues.push(`sessions.idle_timeout_seconds: must be at most ${TOKENS_LIMITS.idle.max} seconds`);
    else if (idle >= refresh) issues.push(`sessions.idle_timeout_seconds: has no effect: the session (${refresh} s) ends before by its maximum lifetime`);
  }
  if (limits.max_sessions_per_user < 0 || limits.max_sessions_per_user > TOKENS_LIMITS.maxSessions) {
    issues.push(`limits.max_sessions_per_user: must be 0 (no limit) or between 1 and ${TOKENS_LIMITS.maxSessions}`);
  }
  if (limits.max_sessions_per_user > 0 && limits.on_limit !== 'revoke_oldest' && limits.on_limit !== 'reject') {
    issues.push('limits.on_limit: must be "revoke_oldest" or "reject"');
  }
  for (const [field, value] of [['revocation.on_password_change', r.on_password_change], ['revocation.on_email_change', r.on_email_change]]) {
    if (value && !['all', 'others', 'none'].includes(value)) issues.push(`${field}: must be "all", "others" or "none"`);
  }
  if (r.on_password_reset && !['all', 'none'].includes(r.on_password_reset)) {
    issues.push('revocation.on_password_reset: must be "all" or "none": a reset has no current session to keep');
  }
  return issues;
}

if (EDITION === 'pro') {
  appBehaviors.push(tokensBehaviorRow);
  appBehaviors.push({
    id: geoAccessBehavior.id, app_id: APP_ID, behavior_code: 'geo_access', is_active: true, config: {},
    created_by: APP_ID, created_at: geoAccessBehavior.created_at, updated_at: geoAccessBehavior.updated_at,
  });
  route('GET', '/api/v1/app-behaviors/tokens', () => ok(describeTokens()));
  route('PUT', '/api/v1/app-behaviors/tokens', async (req) => {
    const body = (await readBody(req)) as unknown as TokensConfig;
    const issues = tokensIssues(body);
    if (issues.length > 0) return fail(422, issues.join('; '), 'app_behaviors.tokens.invalid_config');
    Object.assign(tokensBehaviorRow, { config: body, updated_at: new Date().toISOString() });
    // The `sessions` node is mirrored into email_auth, for an older binary.
    const emailAuth = emailAuthRow();
    if (emailAuth) emailAuthConfig(emailAuth).sessions = body.sessions;
    return ok(describeTokens());
  });
}

// ---- app-behaviors ----
// `/available` is public and the catalog has email_auth only.
const AVAILABLE_BEHAVIORS: Record<string, { name: string; description: string }> = {
  es: {
    name: 'Autenticación por Email',
    description: 'Autenticación por email y contraseña con opción de magic link y verificación de email. Soporta normalización de email, políticas de contraseña y códigos de verificación configurables.',
  },
  en: {
    name: 'Email Authentication',
    description: 'Email and password authentication with optional magic link and email verification. Supports email normalization, password policies, and configurable verification codes.',
  },
};

route('GET', '/api/v1/app-behaviors/available', (req) => {
  const raw = (req.headers.get('Accept-Language') ?? 'en').trim().toLowerCase().split('-')[0];
  const language = raw === 'es' ? 'es' : 'en';
  return ok({
    behaviors: [{
      code: 'email_auth',
      ...AVAILABLE_BEHAVIORS[language],
      example_endpoint: `http://localhost:${PORT}${PREFIX}/api/v1/app-behaviors/examples/email_auth`,
    }],
    language,
  });
});

/** The config of the rows whose state lives with their own endpoint. */
function refreshBehaviorRows() {
  const { updated_at: sessionUpdated, ...sessionSecurity } = sessionSecurityBehavior;
  const live: Record<string, { config: unknown; updated_at: string }> = {
    mfa: { config: { mode: mfaBehavior.mode, flows: mfaBehavior.flows }, updated_at: mfaBehavior.updated_at },
    identity_linking: { config: { mode: identityLinkingBehavior.mode }, updated_at: identityLinkingBehavior.updated_at },
    session_security: { config: sessionSecurity, updated_at: sessionUpdated },
    security_limits: { config: securityLimitsOverrides, updated_at: securityLimitsMeta.updated_at },
    geo_access: { config: geoAccessBehavior.config, updated_at: geoAccessBehavior.updated_at },
  };
  for (const row of appBehaviors) {
    const state = live[String(row.behavior_code)];
    if (state) Object.assign(row, state);
  }
}

route('GET', '/api/v1/app-behaviors', (_req, _params, url) => {
  refreshBehaviorRows();
  const { page, size } = pageParams(url);
  const capped = Math.min(size, 100);
  const rows = appBehaviors.map(({ config: _config, created_by: _createdBy, ...rest }) => rest);
  return paginatedResponse(rows.slice(page * capped, (page + 1) * capped), page, capped, rows.length, '/api/v1/app-behaviors');
});
route('GET', '/api/v1/app-behaviors/:id', (_req, { id }) => {
  refreshBehaviorRows();
  const behavior = appBehaviors.find((b) => b.id === id);
  if (!behavior) return fail(404, 'App behavior not found', 'app_behavior_not_found');
  return ok(behavior);
});

/** Behaviors the generic routes refuse: each one has an endpoint that validates its config. */
function endpointOnly(code: string): boolean {
  return ['identity_linking', 'mfa', 'security_limits', 'session_security'].includes(code)
    || (EDITION === 'pro' && (code === EMBEDDED_AUTH_CODE || code === 'geo_access'));
}

function deepMerge(current: Record<string, unknown>, incoming: Record<string, unknown>): Record<string, unknown> {
  const merged = { ...current };
  const isNode = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
  for (const [key, value] of Object.entries(incoming)) {
    const stored = merged[key];
    merged[key] = isNode(stored) && isNode(value) ? deepMerge(stored, value) : value;
  }
  return merged;
}

function createBehavior(code: string, config: Record<string, unknown>, isActive: boolean, createdBy: string) {
  if (endpointOnly(code)) {
    return fail(422, `the ${code} behavior is configured with its own endpoint`, `app_behaviors.create.use_${code}_endpoint`);
  }
  if (appBehaviors.some((b) => b.behavior_code === code && b.is_active === true)) {
    return fail(409, 'Error creating app behavior: duplicate key', 'app_behaviors.create.error_creating_app_behavior');
  }
  const now = new Date().toISOString();
  const row = {
    id: nextId('beh'), app_id: APP_ID, behavior_code: code, is_active: isActive, config, created_by: createdBy,
    created_at: now, updated_at: now,
  };
  appBehaviors.push(row);
  return ok(row);
}

route('POST', '/api/v1/app-behaviors', async (req) => {
  const body = await readBody(req);
  // The backend asks for a UUID; the mock's app id, which the admin sends, is not one.
  if (!body.created_by) return fail(422, 'created_by must be a valid UUID', 'dto.validate.CreateAppBehaviorsDTO');
  return createBehavior(String(body.behavior_code ?? ''), (body.config ?? {}) as Record<string, unknown>, body.is_active === true, String(body.created_by));
});
route('POST', '/api/v1/app-behaviors/simple', async (req) => {
  const body = await readBody(req);
  const code = String(body.behavior_code ?? '');
  if (!code) return fail(422, 'behavior_code is required', 'dto.validate.SimpleCreateAppBehaviorDTO');
  if (endpointOnly(code)) return createBehavior(code, {}, true, APP_ID);
  if (code !== 'email_auth') return fail(400, `Unknown behavior code: ${code}`, 'app_behaviors.simple_create.unknown_behavior_code');
  return createBehavior(code, structuredClone(NEW_EMAIL_AUTH_CONFIG), true, APP_ID);
});
route('PUT', '/api/v1/app-behaviors/:id', async (req, { id }) => {
  const behavior = appBehaviors.find((b) => b.id === id);
  if (!behavior) return fail(404, 'App behavior not found', 'app_behaviors.update.not_found');
  const code = String(behavior.behavior_code);
  if (code === 'tokens') {
    return fail(422, 'the tokens behavior is configured with PUT /api/v1/app-behaviors/tokens', 'app_behaviors.update.use_tokens_endpoint');
  }
  // Pro: the generic route refuses the embedded_auth row (its config opens CORS
  // to other origins, so it only goes through the validated endpoint).
  if (endpointOnly(code)) {
    return fail(422, `the ${code} behavior is configured with its own endpoint`, `app_behaviors.update.use_${code}_endpoint`);
  }
  const body = await readBody(req);
  if (!body.config) return fail(422, 'config is required', 'dto.validate.UpdateAppBehaviorDTO');
  const incoming = body.config as Record<string, unknown>;
  const current = behavior.config as Record<string, unknown>;
  if ((incoming.identifier ?? '') !== (current.identifier ?? '')) {
    return fail(400, `identifier in request (${JSON.stringify(incoming.identifier ?? '')}) must match the behavior's identifier (${JSON.stringify(current.identifier ?? '')})`, 'app_behaviors.update.identifier_mismatch');
  }
  // Like the backend, `config` merges over the stored one, node by node.
  Object.assign(behavior, { config: deepMerge(current, incoming), updated_at: new Date().toISOString() });
  return ok(behavior);
});

function emailAuthRow() {
  return appBehaviors.find((b) => b.behavior_code === 'email_auth');
}

function emailAuthConfig(row: Record<string, unknown>): EmailAuthConfig & Record<string, unknown> {
  return row.config as EmailAuthConfig & Record<string, unknown>;
}

/** Writes a node of email_auth, as the activation endpoints do. */
function saveEmailNode(row: Record<string, unknown>, node: string, value: unknown) {
  emailAuthConfig(row)[node] = value;
  row.updated_at = new Date().toISOString();
  return ok(row);
}

function emailAuthMissing(scope: string) {
  return fail(404, 'email_auth behavior not found for this app', `app_behaviors.${scope}.behavior_not_found`);
}

// The backend has no deactivate route for magic link: `{ enabled: false }` does it.
route('POST', '/api/v1/app-behaviors/email/magic-link/activate', async (req) => {
  const row = emailAuthRow();
  if (!row) return emailAuthMissing('activate_magic_link');
  const body = await readBody(req);
  if (body.redirect_base_url === '') return fail(422, 'redirect_base_url cannot be empty when provided', 'dto.validate.ActivateEmailAuthMagicLinkDTO');
  if (body.default_redirect_path === '') return fail(422, 'default_redirect_path cannot be empty when provided', 'dto.validate.ActivateEmailAuthMagicLinkDTO');
  const issues = validateMagicLink(body);
  if (issues.length > 0) return fail(422, issues[0].message, 'dto.validate.ActivateEmailAuthMagicLinkDTO');
  const node = emailAuthConfig(row).magic_link ?? {};
  return saveEmailNode(row, 'magic_link', { ...node, ...body, enabled: body.enabled !== false, email_branding: { ...node.email_branding, ...(body.email_branding as object) } });
});
route('POST', '/api/v1/app-behaviors/email/email-code/activate', async (req) => {
  const row = emailAuthRow();
  if (!row) return emailAuthMissing('activate_email_code');
  const body = await readBody(req);
  const node = emailAuthConfig(row).email_code ?? {};
  const merged = { ...node, ...body, enabled: body.enabled !== false, email_branding: { ...node.email_branding, ...(body.email_branding as object) } };
  const issues = validateEmailCode(merged);
  if (issues.length > 0) return fail(422, issues[0].message, issues[0].scope ?? 'dto.validate.ActivateEmailAuthEmailCodeDTO');
  return saveEmailNode(row, 'email_code', merged);
});
route('POST', '/api/v1/app-behaviors/email/testers/activate', async (req) => {
  const row = emailAuthRow();
  if (!row) return emailAuthMissing('activate_testers');
  const body = await readBody(req);
  return saveEmailNode(row, 'testers', { enabled: body.enabled ?? true });
});
route('POST', '/api/v1/app-behaviors/email/sessions/activate', async (req) => {
  const row = emailAuthRow();
  if (!row) return emailAuthMissing('activate_sessions');
  const body = await readBody(req);
  const issues = validateSessions(body);
  if (issues.length > 0) return fail(422, issues[0].message, 'dto.validate.ActivateEmailAuthSessionsDTO');
  const idle = Number(body.idle_timeout_seconds ?? 0);
  if (idle > 0 && idle < 2 * INHERITED_ACCESS_SECONDS) {
    return fail(422, `idle_timeout_seconds must be at least ${2 * INHERITED_ACCESS_SECONDS}: twice the access token lifetime of the app`, 'app_behaviors.activate_sessions.idle_timeout_too_short');
  }
  // An empty body turns rotation on; nothing else ever does on its own.
  const rotation = Object.keys(body).length === 0 ? { refresh_rotation: true } : {};
  return saveEmailNode(row, 'sessions', { ...SESSIONS_DEFAULTS, ...emailAuthConfig(row).sessions, ...body, ...rotation });
});
route('POST', '/api/v1/app-behaviors/email/verification/activate', async (req) => {
  const row = emailAuthRow();
  if (!row) return emailAuthMissing('activate_verification');
  const body = await readBody(req);
  const merged = { ...emailAuthConfig(row).verification, ...body, enabled: true };
  if (merged.code_strategy === 'fixed') {
    const fixed = String(merged.fixed_code ?? '');
    if (!fixed) return fail(422, 'fixed_code is required when code_strategy is "fixed"', 'app_behaviors.activate_verification.fixed_code_required');
    if (fixed.length !== merged.code_size) {
      return fail(422, 'fixed_code length does not match code_size', 'app_behaviors.activate_verification.fixed_code_length_mismatch');
    }
    if (!(merged.code_type === 'alphanumeric' ? /^[0-9A-Za-z]+$/ : /^[0-9]+$/).test(fixed)) {
      return fail(422, 'fixed_code contains characters not allowed', 'app_behaviors.activate_verification.fixed_code_character_class_mismatch');
    }
  }
  return saveEmailNode(row, 'verification', merged);
});
route('POST', '/api/v1/app-behaviors/email/verification/deactivate', () => {
  const row = emailAuthRow();
  if (!row) return emailAuthMissing('deactivate_verification');
  return saveEmailNode(row, 'verification', { ...emailAuthConfig(row).verification, enabled: false });
});
route('POST', '/api/v1/app-behaviors/email/metadata-schema/activate', async (req) => {
  // Like the backend, the schema lives in the email_auth behavior.
  const row = emailAuthRow();
  if (!row) return fail(404, 'App behavior not found', 'app_behaviors.email.not_found');
  const body = await readBody(req);
  if (!Array.isArray(body.scheme) || body.scheme.length === 0) {
    return fail(422, 'scheme must contain at least one field', 'dto.validate.ActivateEmailAuthMetadataSchemaDTO');
  }
  return saveEmailNode(row, 'metadata_schema', { enabled: true, scheme: body.scheme, additional_properties: body.additional_properties ?? true });
});

// ---- user-metadata-policy (Pro): in Community the routes do not exist ----
if (EDITION === 'pro') {
  const policyView = () => ({ app_id: APP_ID, ...userMetadataPolicy });
  route('GET', '/api/v1/user-metadata-policy', () => ok(policyView()));
  route('PUT', '/api/v1/user-metadata-policy', async (req) => {
    const body = await readBody(req);
    const keys = Array.isArray(body.allowed_keys) ? body.allowed_keys.map((k) => String(k).trim()).filter(Boolean) : [];
    const reserved = keys.find((k) => RESERVED_METADATA_CLAIMS.has(k));
    if (reserved) return fail(400, `reserved claim cannot be in allowed_keys: ${reserved}`, 'user_metadata_policy.upsert.reserved_claim');
    userMetadataPolicy.enabled = Boolean(body.enabled);
    userMetadataPolicy.allowed_keys = [...new Set(keys)];
    if (typeof body.include_user_writable === 'boolean') userMetadataPolicy.include_user_writable = body.include_user_writable;
    return ok(policyView());
  });
  route('POST', '/api/v1/user-metadata-policy/preview', async (req) => {
    const metadata = ((await readBody(req)).metadata ?? {}) as Record<string, unknown>;
    const { enabled, allowed_keys: allowed } = userMetadataPolicy;
    if (!enabled) return ok({ extra_claims: {}, reason: 'policy is disabled — access_token will not include any user_metadata' });
    if (allowed.length === 0) return ok({ extra_claims: {}, reason: 'policy has no allowed_keys' });
    const claims = Object.fromEntries(Object.entries(metadata).filter(([k]) => allowed.includes(k)));
    const dropped = allowed.filter((k) => !(k in claims));
    return ok({ extra_claims: claims, ...(dropped.length > 0 ? { dropped_keys: dropped } : {}) });
  });
}

// ---- MCP Connect (Community and Pro) ----
function mcpScopes(resourceId: string, list: unknown) {
  return (Array.isArray(list) ? (list as Record<string, unknown>[]) : []).map((s) => ({
    id: `${resourceId}_${s.key}`, resource_id: resourceId, key: s.key, label: s.label, description: s.description ?? '',
    is_write: Boolean(s.is_write), is_default: s.is_default ?? true, roles: s.roles ?? [],
  }));
}
function mcpScopeError(list: unknown) {
  const keys = new Set<string>();
  for (const s of (Array.isArray(list) ? list : []) as Record<string, unknown>[]) {
    const key = String(s.key ?? '');
    if (!/^[a-z0-9][a-z0-9:._-]{0,63}$/.test(key)) return fail(422, `invalid scope key: ${key}`, 'mcp_resources.invalid_scope_key');
    if (keys.has(key)) return fail(422, `duplicate scope key: ${key}`, 'mcp_resources.duplicate_scope_key');
    keys.add(key);
    if (!String(s.label ?? '').trim()) return fail(422, `scope ${key} needs a label`, 'mcp_resources.invalid_scope_label');
  }
  return null;
}
route('GET', '/v1/mcp-resources', () => ok(mcpResources));
route('POST', '/v1/mcp-resources', async (req) => {
  const body = await readBody(req);
  const resourceUrl = String(body.resource_url ?? '');
  if (!URL.canParse(resourceUrl)) return fail(422, 'resource_url must be an absolute URL', 'mcp_resources.invalid_resource_url');
  if (mcpResources.some((r) => r.resource_url === resourceUrl)) return fail(409, 'this resource_url is already registered', 'mcp_resources.duplicate_resource_url');
  const scopeError = mcpScopeError(body.scopes);
  if (scopeError) return scopeError;
  const id = nextId('mcp');
  const now = new Date().toISOString();
  const list = Array.isArray(body.scopes) && body.scopes.length > 0 ? body.scopes : [{ key: 'account:access', label: 'Acceder a tu cuenta' }];
  const resource = {
    id, app_id: APP_ID, name: body.name || new URL(resourceUrl).hostname, resource_url: resourceUrl, login_url: body.login_url,
    access_ttl_seconds: body.access_ttl_seconds ?? 3600, cimd_enabled: body.cimd_enabled ?? true, dcr_enabled: body.dcr_enabled ?? true,
    allowed_redirect_domains: body.allowed_redirect_domains ?? [], allowed_client_domains: body.allowed_client_domains ?? [],
    scopes: mcpScopes(id, list), ...mcpResourceUrls(resourceUrl), verified_at: null, created_at: now, updated_at: now,
  };
  mcpResources.push(resource);
  return ok(resource, 201);
});
route('PATCH', '/v1/mcp-resources/:id', async (req, { id }) => {
  const resource = mcpResources.find((r) => r.id === id);
  if (!resource) return fail(404, 'MCP resource not found', 'mcp_resources.not_found');
  Object.assign(resource, await readBody(req), { updated_at: new Date().toISOString() });
  return ok(resource);
});
route('DELETE', '/v1/mcp-resources/:id', (_req, { id }) => {
  const idx = mcpResources.findIndex((r) => r.id === id);
  if (idx === -1) return fail(404, 'MCP resource not found', 'mcp_resources.not_found');
  const [removed] = mcpResources.splice(idx, 1);
  return ok(removed);
});
route('PUT', '/v1/mcp-resources/:id/scopes', async (req, { id }) => {
  const resource = mcpResources.find((r) => r.id === id);
  if (!resource) return fail(404, 'MCP resource not found', 'mcp_resources.not_found');
  const { scopes } = await readBody(req);
  const scopeError = mcpScopeError(scopes);
  if (scopeError) return scopeError;
  resource.scopes = mcpScopes(id, scopes);
  return ok(resource.scopes);
});
route('POST', '/v1/mcp-resources/:id/verify', (_req, { id }) => {
  const resource = mcpResources.find((r) => r.id === id);
  if (!resource) return fail(404, 'MCP resource not found', 'mcp_resources.not_found');
  // A server that has not deployed the two values yet: only the first check passes.
  const verified = resource.verify_report !== undefined || !String(resource.resource_url).includes('support.');
  const at = new Date().toISOString();
  const checks = [
    { name: 'reachable', status: 'passed' },
    verified
      ? { name: 'challenge_401', status: 'passed' }
      : { name: 'challenge_401', status: 'failed', detail: 'The server answered without asking for a token.', expected: '401', found: '200' },
    ...['metadata_fetched', 'resource_matches', 'authorization_server_matches'].map((name) => ({ name, status: verified ? 'passed' : 'skipped' })),
  ];
  const report = { verified, checks, at };
  Object.assign(resource, { verify_report: report, verified_at: verified ? at : null });
  return ok(report);
});
route('GET', '/v1/mcp/connections', (_req, _p, url) => {
  const page = Number(url.searchParams.get('page') ?? '1') || 1;
  const size = Number(url.searchParams.get('size') ?? '20') || 20;
  const q = url.searchParams;
  const rows = mcpConnections.filter((c) => {
    const person = c.user as { email?: string };
    return (!q.get('resource_id') || (c.resource as { id: string }).id === q.get('resource_id'))
      && (!q.get('user_id') || c.user_id === q.get('user_id'))
      && (!q.get('email') || person.email === q.get('email'))
      && (!q.get('status') || c.status === q.get('status'));
  });
  return ok({ items: rows.slice((page - 1) * size, page * size), total: rows.length, page, size });
});
route('GET', '/v1/mcp/connections/summary', (_req, _p, url) => {
  const ids = [...new Set((url.searchParams.get('user_ids') ?? '').split(',').map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return fail(400, 'user_ids is required', 'mcp_connections.summary.user_ids_required');
  if (ids.length > 100) return fail(400, 'at most 100 user_ids per call', 'mcp_connections.summary.too_many');
  return ok(Object.fromEntries(ids.map((id) => [id, mcpConnections.filter((c) => c.user_id === id && c.status === 'active').length])));
});
route('DELETE', '/v1/mcp/connections/:id', (_req, { id }) => {
  const connection = mcpConnections.find((c) => c.id === id);
  if (!connection) return fail(404, 'MCP connection not found', 'mcp_connections.not_found');
  if (connection.status === 'active') Object.assign(connection, { status: 'revoked', revoked_at: new Date().toISOString(), revoked_reason: 'owner' });
  return ok(connection);
});

// ---- login events (Community and Pro) ----
function loginEventsInRange(url: URL) {
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  return loginEvents.filter((e) => {
    const at = Date.parse(String(e.created_at));
    return (!from || at >= Date.parse(from)) && (!to || at <= Date.parse(to));
  });
}
route('GET', '/api/v1/login-events', (_req, _p, url) => {
  const { page } = pageParams(url);
  const size = Math.min(Number(url.searchParams.get('size') ?? '20') || 20, 100);
  const filters: [string, string][] = [['user_id', 'user_id'], ['country', 'country_code'], ['type', 'type'], ['method', 'method'], ['geo_source', 'geo_source']];
  const rows = loginEventsInRange(url).filter((e) =>
    filters.every(([param, field]) => {
      const value = url.searchParams.get(param);
      return !value || e[field] === (param === 'country' ? value.toUpperCase() : value);
    }),
  );
  const { slice, total } = paginate(rows, page, size);
  return paginatedResponse(slice, page, size, total, '/api/v1/login-events');
});
route('GET', '/api/v1/login-events/summary', (_req, _p, url) => {
  // Like the backend: only sign-ins and blocks count, not IP changes nor failures.
  const attempts = loginEventsInRange(url).filter((e) => e.type === 'login_succeeded' || e.type === 'login_blocked');
  const countries = new Map<string, { country_code: string; country_name: string; logins: number; blocked: number; ips: Set<unknown> }>();
  const sources = { database: 0, headers: 0, none: 0 };
  for (const e of attempts) {
    const code = String(e.country_code);
    const row = countries.get(code) ?? { country_code: code, country_name: String(e.country_name ?? ''), logins: 0, blocked: 0, ips: new Set() };
    if (e.type === 'login_blocked') row.blocked += 1;
    else row.logins += 1;
    row.ips.add(e.ip);
    countries.set(code, row);
    sources[e.geo_source as keyof typeof sources] += 1;
  }
  return ok({
    from: url.searchParams.get('from') ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    to: url.searchParams.get('to') ?? new Date().toISOString(),
    logins: attempts.filter((e) => e.type === 'login_succeeded').length,
    blocked: attempts.filter((e) => e.type === 'login_blocked').length,
    unique_ips: new Set(attempts.map((e) => e.ip)).size,
    unique_users: new Set(attempts.filter((e) => e.type === 'login_succeeded').map((e) => e.user_id)).size,
    countries: [...countries.values()]
      .sort((a, b) => b.logins - a.logins)
      .map(({ ips, ...row }) => ({ ...row, unique_ips: ips.size })),
    sources,
  });
});

// ---- system ----
route('GET', '/api/v1/system/public-key-jwt', () => ok({ kty: 'RSA', use: 'sig', alg: 'RS256', kid: 'mock-key-1', n: 'mock-modulus', e: 'AQAB' }));
route('GET', '/api/v1/system/email-templates', () => ok([
  { id: 'tmpl_1', name: 'signup_verification', subject: 'Verify your email' },
  { id: 'tmpl_2', name: 'magic_link', subject: 'Your sign-in link' },
]));
route('POST', '/api/v1/system/email-templates/preview', async (req) => {
  const body = await readBody(req);
  return ok({ html: `<html><body>Mock preview for ${body.name ?? 'template'}</body></html>` });
});
route('GET', '/api/v1/system/env', () => ok({ environment: 'local', reveal_sensitive: false }));

// ---- email templates ----
// Two route families, like internal/api/v1/email_templates/setup.go: per-app with
// the secret key and global with the admin key. `appId` is '' on the global ones.
// As in the use cases: only Pro writes per-app rows, only Community writes the
// global row, and reads, previews and tests answer in both editions.
type EmailOverride = { id: string; app_id: string; template_id: string; locale: string; enabled: boolean; subject: string; from_name: string; html: string; text: string; html_baseline_ref: string; created_at: string; updated_at: string };
type EmailSelection = { themeId: string; branding: EmailBranding };

const emailOverrides = new Map<string, EmailOverride>();
const emailSelections = new Map<string, EmailSelection>();
const emailTestSends = new Map<string, number[]>();

const emailOverrideKey = (appId: string, templateId: string, locale: string) => `${appId}|${templateId}|${locale}`;

function seedEmailOverride(appId: string, templateId: string, heading: string) {
  const entry = emailCatalog.find((e) => e.id === templateId)!;
  const now = new Date().toISOString();
  emailOverrides.set(emailOverrideKey(appId, templateId, 'en'), {
    id: nextId('tpl'), app_id: appId, template_id: templateId, locale: 'en', enabled: true,
    subject: entry.subject_default, from_name: entry.from_name_default,
    html: `<!doctype html><html><body style="margin:0;padding:32px;background:#f8fafc;font-family:Georgia,serif;color:#1f2937"><h1 style="font-size:24px">${heading}</h1><p>Hello {user_name}, this is the custom HTML of <strong>{app_name}</strong>.</p><p>Sent {event_at} from {ip}.</p></body></html>`,
    text: '', html_baseline_ref: entry.baseline_ref, created_at: now, updated_at: now,
  });
}

// Seeds: an override of the edition's own scope and a global one, which in Pro
// is the case of an app inheriting a template it cannot edit.
seedEmailOverride(EDITION === 'pro' ? APP_ID : '', 'welcome', 'Welcome aboard');
seedEmailOverride('', 'password_changed_notice', 'Your password changed');
emailSelections.set(EDITION === 'pro' ? APP_ID : '', {
  themeId: 'daylight',
  branding: { display_name: 'Acme', accent_color: '#7c3aed', support_email: 'help@acme.example' },
});

function emailEditionRejects(appId: string) {
  return appId === '' ? EDITION !== 'community' : EDITION !== 'pro';
}

function emailProRequired() {
  return fail(403, 'per-app email templates require Pro edition; this deploy can only edit the global override', 'email_templates.pro_required');
}

function activeEmailSelection(appId: string): { selection: EmailSelection; scope: 'app' | 'global' | 'default' } {
  const own = EDITION === 'pro' && appId ? emailSelections.get(appId) : undefined;
  if (own) return { selection: own, scope: 'app' };
  const global = emailSelections.get('');
  if (global) return { selection: global, scope: 'global' };
  return { selection: { themeId: DEFAULT_EMAIL_THEME, branding: {} }, scope: 'default' };
}

const EMAIL_SAMPLE_VARS: Record<string, string> = {
  user_name: 'Ada Lovelace', activation_code: '123456', otp_code: '987654', reset_password_code: '654321',
  expiry_minutes: '10', app_name: 'My App', new_email: 'ada@example.com',
  magic_url: 'https://example.com/auth/verify?token=preview', activation_url: 'https://example.com/auth/activate?token=preview',
  reset_url: 'https://example.com/auth/reset?token=preview', support_email: 'support@example.com',
  support_url: 'https://example.com/support', event_at: '2026-06-19 12:34:56 UTC', ip: '203.0.113.42',
  user_agent: 'Mozilla/5.0 (preview)', year: '2026', current_date: '2026-06-19',
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fillEmailVars = (body: string, vars: Record<string, string>) =>
  body.replace(/\{([a-z_]+)\}/g, (raw, name: string) => (name in vars ? vars[name] : raw));

/** An approximation of catalog.RenderHTML: same tokens and branding, simpler markup. */
function renderEmailTheme({ themeId, branding }: EmailSelection, entry: EmailCatalogEntry) {
  const theme = emailThemes.find((th) => th.id === themeId) ?? emailThemes[0];
  const t = theme.tokens;
  const accent = branding.accent_color ?? t.accent;
  const corners = branding.corners ?? t.corners;
  const radius = corners === 'sharp' ? 0 : corners === 'round' ? 16 : 8;
  const families: Record<string, string> = { sans: 'Helvetica,Arial,sans-serif', serif: 'Georgia,serif', mono: 'Menlo,monospace' };
  const font = families[branding.font ?? t.font];
  const code = entry.required_variables.find((v) => v.endsWith('_code'));
  const link = entry.required_variables.find((v) => v.endsWith('_url'));
  const action = code
    ? `<p style="font-size:28px;font-weight:700;letter-spacing:4px;color:${accent}">{${code}}</p>`
    : link
      ? `<p><a href="{${link}}" style="display:inline-block;padding:10px 20px;background:${accent};color:#fff;text-decoration:none;border-radius:${radius}px">${entry.name}</a></p>`
      : '';
  const logo = branding.logo_url
    ? `<img src="${escapeHtml(branding.logo_url)}" alt="${escapeHtml(branding.display_name ?? '{app_name}')}" height="40">`
    : `<strong style="color:${t.heading}">${escapeHtml(branding.display_name ?? '{app_name}')}</strong>`;
  const footer = [
    branding.footer_text ? escapeHtml(branding.footer_text).replace(/\n/g, '<br>') : '',
    branding.support_email ? `Need help? <a href="mailto:${escapeHtml(branding.support_email)}" style="color:${accent}">${escapeHtml(branding.support_email)}</a>` : '',
    'You received this email because of your {app_name} account.',
  ].filter(Boolean).join('<br>');
  return `<!doctype html><html><body style="margin:0;padding:32px 16px;background:${t.canvas};font-family:${font};color:${t.text};text-align:${t.align}">
<div style="max-width:520px;margin:0 auto">
<div style="margin-bottom:16px">${logo}</div>
<div style="background:${t.surface};border:1px solid ${t.border};border-radius:${radius}px;overflow:hidden">
${t.top_bar ? `<div style="height:4px;background:${accent}"></div>` : ''}
<div style="padding:32px">
<h1 style="margin:0 0 12px;font-size:22px;color:${t.heading};font-family:${families[branding.font ?? t.heading_font]}">${entry.subject_default}</h1>
<p>Hello {user_name}, ${entry.description}</p>
${action}
</div></div>
<p style="margin-top:16px;font-size:12px;color:${t.muted}">${footer}</p>
</div></body></html>`;
}

/** resolver.ResolveChain for one locale: the app's override, the global one, the theme. */
function resolveEmail(appId: string, entry: EmailCatalogEntry, locale: string, selection: EmailSelection, sample: Record<string, string>) {
  const vars = { ...EMAIL_SAMPLE_VARS, ...sample };
  const passes = EDITION === 'pro' && appId ? [{ appId, source: 'per_app_db' }, { appId: '', source: 'global_db' }] : [{ appId: '', source: 'global_db' }];
  for (const pass of passes) {
    const row = emailOverrides.get(emailOverrideKey(pass.appId, entry.id, locale));
    if (row?.enabled) {
      return { subject: fillEmailVars(row.subject, vars), from_name: fillEmailVars(row.from_name, vars), html: fillEmailVars(row.html, vars), source: pass.source, warnings: [] };
    }
  }
  return {
    subject: fillEmailVars(entry.subject_default, vars),
    from_name: fillEmailVars(entry.from_name_default, vars),
    html: fillEmailVars(renderEmailTheme(selection, entry), vars),
    source: `theme:${selection.themeId}`,
    warnings: [],
  };
}

const BRANDING_PROBLEMS: Record<BrandingErrorKey, string> = {
  logoUrl: 'must be a valid https URL',
  displayNameLength: 'must be at most 80 characters',
  accentHex: 'must be a hex colour like #3bc7cb',
  footerLength: 'must be at most 300 characters',
  footerLines: 'must be plain text of at most 6 lines',
  supportEmail: 'must be a valid email address',
};

function brandingProblems(branding: EmailBranding) {
  const problems = Object.entries(brandingErrors(branding)).map(([field, key]) => `${field}: ${BRANDING_PROBLEMS[key]}`);
  return problems.length ? problems.join('; ') : null;
}

const EMAIL_PLACEHOLDER = /\{([a-z_]+)\}/g;

function upsertEmailTemplate(appId: string, templateId: string, body: Record<string, unknown>) {
  if (emailEditionRejects(appId)) return emailProRequired();
  const entry = emailCatalog.find((e) => e.id === templateId);
  if (!entry) return fail(404, 'unknown email template id', 'email_templates.unknown_template');
  const locale = String(body.locale ?? '').trim().toLowerCase() || 'en';
  const subject = String(body.subject ?? '').trim();
  if (!subject) return fail(422, 'subject is required', 'email_templates.subject_required');
  if (/[\r\n]/.test(subject) || subject.length > 200) {
    return fail(422, 'subject must not contain line breaks and be under 200 characters', 'email_templates.subject_invalid');
  }
  const rawHtml = String(body.html ?? '');
  if (!rawHtml.trim()) return fail(422, 'html body is required', 'email_templates.html_required');
  if (new TextEncoder().encode(rawHtml).length > 200 * 1024) return fail(422, 'html body exceeds the 200 KB limit', 'email_templates.html_too_large');

  // The real sanitizer strips what it does not allow and reports it.
  const html = rawHtml.replace(/<script[\s\S]*?<\/script>/gi, '');
  const warnings = html === rawHtml ? [] : ['removed: script'];
  const found = [...html.matchAll(EMAIL_PLACEHOLDER)].map((m) => m[1]);
  const missing = entry.required_variables.filter((v) => !found.includes(v));
  if (missing.length) return fail(422, 'html body is missing required placeholders for this template', 'email_templates.missing_required_variables', { missing });
  const forbidden = found.filter((v) => emailCatalogMeta.forbidden_variables.includes(v));
  if (forbidden.length) return fail(422, 'html body references forbidden placeholders (password, api_key, etc.)', 'email_templates.forbidden_variables', { forbidden });
  const allowed = [...entry.required_variables, ...entry.optional_variables, ...emailCatalogMeta.allowed_globals];
  for (const name of new Set(found)) if (!allowed.includes(name)) warnings.push(`unknown placeholder: ${name}`);

  const key = emailOverrideKey(appId, templateId, locale);
  const existing = emailOverrides.get(key);
  const now = new Date().toISOString();
  const row: EmailOverride = {
    id: existing?.id ?? nextId('tpl'), app_id: appId, template_id: templateId, locale,
    enabled: body.enabled === undefined ? true : !!body.enabled,
    subject, from_name: String(body.from_name ?? ''), html, text: String(body.text ?? ''),
    html_baseline_ref: entry.baseline_ref, created_at: existing?.created_at ?? now, updated_at: now,
  };
  emailOverrides.set(key, row);
  return ok({ template: row, ...(warnings.length ? { warnings } : {}) });
}

function emailTemplateRoutes(base: string, appId: string) {
  route('GET', `${base}/catalog`, () => {
    const rows = [...emailOverrides.values()].filter((r) => r.app_id === appId);
    const items = emailCatalog.map((entry) => {
      const own = rows.filter((r) => r.template_id === entry.id);
      return {
        ...entry,
        has_override: own.length > 0,
        override_enabled: own[0]?.enabled ?? false,
        ...(own.length ? { override_locales: own.map((r) => r.locale) } : {}),
      };
    });
    return ok({ ...emailCatalogMeta, items });
  });

  route('GET', `${base}/themes`, () => {
    const { selection, scope } = activeEmailSelection(appId);
    const preview = emailCatalog.find((e) => e.id === 'signup_activation_code')!;
    return ok({
      default_theme_id: DEFAULT_EMAIL_THEME,
      active_theme_id: selection.themeId,
      scope,
      branding: selection.branding,
      themes: emailThemes.map((theme) => ({
        ...theme,
        preview_html: fillEmailVars(renderEmailTheme({ themeId: theme.id, branding: selection.branding }, preview), EMAIL_SAMPLE_VARS),
        preview_template_id: preview.id,
      })),
    });
  });

  route('GET', `${base}/themes/active`, () => {
    const { selection, scope } = activeEmailSelection(appId);
    return ok({ theme_id: selection.themeId, scope, branding: selection.branding });
  });

  route('PUT', `${base}/themes/active`, async (req) => {
    const body = await readBody(req);
    if (emailEditionRejects(appId)) return fail(403, 'Per-app theme selection requires Pro edition', 'email_templates.themes.pro_required');
    const themeId = String(body.theme_id ?? '');
    if (!emailThemes.some((th) => th.id === themeId)) return fail(422, 'unknown theme id', 'email_templates.themes.unknown_theme');
    let branding = emailSelections.get(appId)?.branding ?? {};
    if (body.branding !== undefined) {
      branding = compactBranding(body.branding as EmailBranding);
      const problems = brandingProblems(branding);
      if (problems) return fail(422, problems, 'email_templates.themes.invalid_branding');
    }
    emailSelections.set(appId, { themeId, branding });
    return ok({ theme_id: themeId, scope: appId ? 'app' : 'global', branding });
  });

  route('GET', `${base}/:id`, (_req, { id }, url) => {
    const entry = emailCatalog.find((e) => e.id === id);
    if (!entry) return fail(404, 'unknown email template id', 'email_templates.unknown_template');
    const locale = url.searchParams.get('locale') || 'en';
    const row = emailOverrides.get(emailOverrideKey(appId, id, locale));
    if (row) {
      return ok({
        source: 'override', baseline_ref: row.html_baseline_ref, template_id: id, locale, enabled: row.enabled,
        subject: row.subject, from_name: row.from_name, html: row.html, ...(row.text ? { text: row.text } : {}),
        baseline: entry, override: row,
      });
    }
    const { selection } = activeEmailSelection(appId);
    return ok({
      source: 'baseline', baseline_ref: `${entry.baseline_ref}+theme:${selection.themeId}`, template_id: id, locale, enabled: true,
      subject: entry.subject_default, from_name: entry.from_name_default, html: renderEmailTheme(selection, entry), baseline: entry,
    });
  });

  route('PUT', `${base}/:id`, async (req, { id }) => upsertEmailTemplate(appId, id, await readBody(req)));

  route('DELETE', `${base}/:id`, (_req, { id }, url) => {
    if (emailEditionRejects(appId)) return emailProRequired();
    emailOverrides.delete(emailOverrideKey(appId, id, url.searchParams.get('locale') ?? ''));
    return new Response(null, { status: 204 });
  });

  route('POST', `${base}/:id/preview`, async (req, { id }) => {
    const body = await readBody(req);
    let { selection } = activeEmailSelection(appId);
    if (body.theme_id || body.branding) {
      const themeId = String(body.theme_id ?? '') || selection.themeId;
      if (!emailThemes.some((th) => th.id === themeId)) return fail(422, 'unknown theme id', 'email_templates.themes.unknown_theme');
      const branding = body.branding ? compactBranding(body.branding as EmailBranding) : selection.branding;
      const problems = brandingProblems(branding);
      if (problems) return fail(422, problems, 'email_templates.themes.invalid_branding');
      selection = { themeId, branding };
    }
    const entry = emailCatalog.find((e) => e.id === id);
    if (!entry) return fail(404, 'unknown email template id', 'email_templates.preview.unknown_template');
    return ok(resolveEmail(appId, entry, String(body.locale || 'en'), selection, (body.sample_variables ?? {}) as Record<string, string>));
  });

  route('POST', `${base}/:id/test`, async (req, { id }) => {
    const body = await readBody(req);
    const to = String(body.to_email ?? '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return fail(422, 'to_email must be a valid email', 'dto.validate.TestEmailTemplateDTO');
    const scope = appId || '__global__';
    const recent = (emailTestSends.get(scope) ?? []).filter((at) => Date.now() - at < 60_000);
    if (recent.length >= 10) return fail(429, 'too many test emails — try again later', 'email_templates.test.rate_limited');
    const entry = emailCatalog.find((e) => e.id === id);
    if (!entry) return fail(404, 'unknown email template id', 'email_templates.unknown_template');
    emailTestSends.set(scope, [...recent, Date.now()]);
    const { selection } = activeEmailSelection(appId);
    const resolved = resolveEmail(appId, entry, String(body.locale || 'en'), selection, (body.sample_variables ?? {}) as Record<string, string>);
    return ok({
      message_id: nextId('msg'), provider: 'smtp', source: resolved.source,
      rendered_html_preview: resolved.html.slice(0, 4096), warnings: resolved.warnings,
    });
  });
}

emailTemplateRoutes('/api/v1/email-templates', APP_ID);
emailTemplateRoutes('/v1/email-templates', '');

// Every email goes out with the instance's sender, in both editions.
route('GET', '/api/v1/email-config', () => ok({ client: 'smtp', sender: 'no-reply@accounts.mock', source: 'instance' }));

// ---- email-access ----
route('GET', '/api/v1/email-access/settings', () => ok(emailAccessSettings));
route('PUT', '/api/v1/email-access/settings', async (req) => {
  Object.assign(emailAccessSettings, await readBody(req));
  return ok(emailAccessSettings);
});
route('POST', '/api/v1/email-access/test', async (req) => {
  const body = await readBody(req);
  const email = String(body.email ?? '');
  const blocked = emailBlocklist.some((e) => e.email === email);
  return ok({ email, allowed: !blocked, reason: blocked ? 'blocklisted' : 'default_action' });
});
route('GET', '/api/v1/email-access/blocklist', (_req, _p, url) => {
  const { page, size } = pageParams(url);
  const { slice, total } = paginate(emailBlocklist, page, size);
  return paginatedResponse(slice, page, size, total, '/api/v1/email-access/blocklist');
});
route('POST', '/api/v1/email-access/blocklist', async (req) => {
  const body = await readBody(req);
  const entry = { id: nextId('blk'), app_id: APP_ID, created_at: new Date().toISOString(), ...body };
  emailBlocklist.push(entry);
  return ok(entry, 201);
});
route('DELETE', '/api/v1/email-access/blocklist/:entryId', (_req, { entryId }) => {
  const idx = emailBlocklist.findIndex((e) => e.id === entryId);
  if (idx === -1) return fail(404, 'Entry not found', 'email_access.delete.not_found');
  const [removed] = emailBlocklist.splice(idx, 1);
  return ok(removed);
});
route('GET', '/api/v1/email-access/allowlist', (_req, _p, url) => {
  const { page, size } = pageParams(url);
  const { slice, total } = paginate(emailAllowlist, page, size);
  return paginatedResponse(slice, page, size, total, '/api/v1/email-access/allowlist');
});
route('POST', '/api/v1/email-access/allowlist', async (req) => {
  const body = await readBody(req);
  const entry = { id: nextId('alw'), app_id: APP_ID, created_at: new Date().toISOString(), ...body };
  emailAllowlist.push(entry);
  return ok(entry, 201);
});
route('DELETE', '/api/v1/email-access/allowlist/:entryId', (_req, { entryId }) => {
  const idx = emailAllowlist.findIndex((e) => e.id === entryId);
  if (idx === -1) return fail(404, 'Entry not found', 'email_access.delete.not_found');
  const [removed] = emailAllowlist.splice(idx, 1);
  return ok(removed);
});

// ---- emails (publishable-key signup/signin flow) ----
route('POST', '/api/v1/emails/signup', async (req) => {
  const body = await readBody(req);
  const id = nextId('user');
  return ok({ id, email: body.email, user_name: body.user_name ?? '' }, 201);
});
route('POST', '/api/v1/emails/signup/resend-code', () => ok({ sent: true }));
route('POST', '/api/v1/emails/signin', async (req) => {
  const body = await readBody(req);
  return ok({ access_token: `mock_access_${nextId('tok')}`, refresh_token: `mock_refresh_${nextId('tok')}`, email: body.email });
});
route('POST', '/api/v1/emails/activate', () => ok({ activated: true }));

// ---- tokens (Next.js proxies these as POST but forwards to the backend as GET) ----
route('GET', '/api/v1/validate-refresh', () => ok({ valid: true, expires_at: new Date(Date.now() + 3600_000).toISOString() }));
route('GET', '/api/v1/refresh-jwt', () => ok({ access_token: `mock_access_${nextId('tok')}`, refresh_token: `mock_refresh_${nextId('tok')}` }));
route('GET', '/api/v1/validate-access', () => ok({ valid: true, user_id: users[0]?.id }));

// ---- revoke-refresh ----
route('POST', '/api/v1/revoke-refresh', () => ok({ revoked: true }));
route('DELETE', '/api/v1/revoke-refresh/:tokenId', (_req, { tokenId }) => ok({ revoked: true, token_id: tokenId }));

// ---- oauths/link ----
route('GET', '/api/v1/oauths/link', (_req, _p, url) => {
  const provider = url.searchParams.get('provider') ?? 'google';
  const platform = url.searchParams.get('platform') ?? 'web';
  return ok({ url: `https://mock-oauth.example.com/authorize?provider=${provider}&platform=${platform}&state=mock` });
});

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const match = r.pattern.exec(url);
      if (!match) continue;
      const params = Object.fromEntries(Object.entries(match.pathname.groups).filter(([, v]) => v !== undefined)) as Record<string, string>;
      try {
        return await r.handler(req, params, url);
      } catch (err) {
        console.error(`[mock] handler error for ${req.method} ${url.pathname}:`, err);
        return fail(500, 'Mock server handler error');
      }
    }
    console.warn(`[mock] no route for ${req.method} ${url.pathname}`);
    return fail(404, `No mock route for ${req.method} ${url.pathname}`, 'mock.route_not_found');
  },
});

console.log(`Mock accounts backend listening on http://localhost:${PORT}${PREFIX}`);
