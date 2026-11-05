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
  APP_ID, apps, appBehaviors, apiKeys, emailAccessSettings, emailAllowlist, emailBlocklist, geoAccessBehavior,
  identityLinkingBehavior, loginEvents, mcpConnections, mcpResources, mcpResourceUrls, mfaBehavior, nextId, oauthAudiences, oauthConfigs, paginate, policies, queryDeliveryUsage,
  rolePolicies, roles, securityLimitsDefaults, securityLimitsMeta, securityLimitsOverrides, securityLimitsRanges, sessionSecurityBehavior,
  sessionSecurityDefaults, userMetadataPolicy, users, webhookEvents, webhooks,
} from './data';
// Embedded Auth mirrors the backend contract with the admin's own client-side
// model (no `@/` alias here: Bun resolves this file's relative imports only).
import {
  checkOrigin, checkRedirect, defaultEmbeddedAuthConfig, intersectStrategies, joinIssues, normalizeEmbeddedAuthConfig,
  normalizeProvider, validateEmbeddedAuthConfig,
} from '../src/lib/embedded-auth';
import type { EmbeddedAuthAccent, EmbeddedAuthConfig, EmbeddedAuthStrategies } from '../src/lib/admin-types';
import { isIsoCountryCode } from '../src/lib/countries';
import { RESERVED_KEYS as RESERVED_METADATA_CLAIMS } from '../src/lib/user-metadata';

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
  // The backend reads email_auth.config.magic_link.enabled; this mock's own
  // magic-link toggle (POST /email/magic-link/activate) flips the separate
  // `magic_link` seed row instead, so either one counts here.
  const magicLinkRow = appBehaviors.some((b) => b.behavior_code === 'magic_link' && b.is_active === true);
  const oauth = [...new Set(oauthConfigs.filter((c) => c.enabled === true).map((c) => normalizeProvider(String(c.provider ?? ''))))]
    .filter(Boolean)
    .sort();
  return {
    password: !!emailAuth,
    email_code: !!emailAuth && nodeEnabled('email_code'),
    magic_link: !!emailAuth && (nodeEnabled('magic_link') || magicLinkRow),
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
  // Like the backend, no row exists until the first PUT: GET answers the
  // defaults (not configured, disabled) and the seeded behavior lists stay
  // exactly as before.
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

// ---- app-behaviors ----
route('GET', '/api/v1/app-behaviors', () => ok(appBehaviors.map(({ config: _c, ...rest }) => rest)));
route('GET', '/api/v1/app-behaviors/:id', (_req, { id }) => {
  const behavior = appBehaviors.find((b) => b.id === id);
  if (!behavior) return fail(404, 'Behavior not found', 'app_behaviors.get.not_found');
  return ok(behavior);
});
route('PUT', '/api/v1/app-behaviors/:id', async (req, { id }) => {
  const behavior = appBehaviors.find((b) => b.id === id);
  if (!behavior) return fail(404, 'Behavior not found', 'app_behaviors.update.not_found');
  // Pro: the generic route refuses the embedded_auth row (its config opens CORS
  // to other origins, so it only goes through the validated endpoint).
  if (EDITION === 'pro' && behavior.behavior_code === EMBEDDED_AUTH_CODE) {
    return fail(422, 'the embedded_auth behavior is configured with PUT /api/v1/app-behaviors/embedded-auth', 'app_behaviors.update.use_embedded_auth_endpoint');
  }
  // Like the backend, `config` merges over the stored one.
  const body = await readBody(req);
  const config = { ...(behavior.config as object), ...(body.config as object) };
  Object.assign(behavior, body, { config, updated_at: new Date().toISOString() });
  return ok(behavior);
});
function setBehaviorActive(code: string, active: boolean) {
  const behavior = appBehaviors.find((b) => b.behavior_code === code);
  if (behavior) behavior.is_active = active;
  return behavior ?? null;
}
route('POST', '/api/v1/app-behaviors/email/magic-link/activate', () => ok(setBehaviorActive('magic_link', true)));
route('POST', '/api/v1/app-behaviors/email/magic-link/deactivate', () => ok(setBehaviorActive('magic_link', false)));
route('POST', '/api/v1/app-behaviors/email/verification/activate', () => ok(setBehaviorActive('email_auth', true)));
route('POST', '/api/v1/app-behaviors/email/verification/deactivate', () => ok(setBehaviorActive('email_auth', false)));
route('POST', '/api/v1/app-behaviors/email/metadata-schema/activate', async (req) => {
  // Like the backend, the schema lives in the email_auth behavior.
  const behavior = appBehaviors.find((b) => b.behavior_code === 'email_auth');
  if (!behavior) return fail(404, 'App behavior not found', 'app_behaviors.email.not_found');
  const body = await readBody(req);
  behavior.config = {
    ...(behavior.config as object),
    metadata_schema: { enabled: true, scheme: body.scheme ?? [], additional_properties: body.additional_properties ?? true },
  };
  return ok(behavior);
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
