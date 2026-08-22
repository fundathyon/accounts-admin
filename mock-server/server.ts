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
  APP_ID, apps, appBehaviors, apiKeys, emailAccessSettings, emailAllowlist, emailBlocklist,
  nextId, oauthAudiences, oauthConfigs, paginate, policies, rolePolicies, roles, users, webhookEvents, webhooks,
} from './data';

const PORT = Number(process.env.MOCK_PORT || 8099);
const PREFIX = '/accounts'; // matches INTERNAL_API_URL's own "/accounts" path segment

function ok(data: unknown, status = 200, meta?: Record<string, unknown>) {
  return Response.json({ success: true, status_code: status, data, ...(meta ? { meta } : {}) }, { status });
}

function fail(status: number, message: string, scope?: string) {
  return Response.json({ success: false, status_code: status, error: { code: status, message, ...(scope ? { scope } : {}) } }, { status });
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
route('POST', '/api/v1/policies', async (req) => {
  const body = await readBody(req);
  const policy = { id: nextId('policy'), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), app_id: APP_ID, ...body };
  policies.push(policy);
  return ok(policy, 201);
});

// ---- role_policies ----
route('GET', '/api/v1/role_policies/:roleId', (_req, { roleId }) => {
  const ids = rolePolicies[roleId] ?? [];
  return ok(policies.filter((p) => ids.includes(p.id as string)));
});
route('POST', '/api/v1/role_policies', async (req) => {
  const body = await readBody(req);
  const roleId = String(body.role_id ?? '');
  const policyId = String(body.policy_id ?? '');
  rolePolicies[roleId] = [...new Set([...(rolePolicies[roleId] ?? []), policyId])];
  return ok({ role_id: roleId, policy_id: policyId }, 201);
});

// ---- api-keys ----
route('GET', '/api/v1/api-keys', () => ok(apiKeys.map(({ secret_key: _s, secret_hash: _h, ...rest }: any) => rest)));
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
  (key as any).is_active = false;
  (key as any).revoked_at = new Date().toISOString();
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
  (user as any).role_id = body.role;
  (user as any).role_details = roles.find((r) => r.id === body.role) ?? null;
  return ok(user);
});
route('PATCH', '/api/v1/users/:id/metadata', async (req, { id }) => {
  const user = users.find((u) => u.id === id);
  if (!user) return fail(404, 'User not found', 'users.update.not_found');
  (user as any).metadata = await readBody(req);
  return ok(user);
});

// ---- dashboard-stats ----
route('GET', '/api/v1/dashboard-stats', () => ok({
  users: users.length, webhooks: webhooks.length, behaviors: appBehaviors.filter((b: any) => b.is_active).length,
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
  (config as any).enabled = false;
  return ok(config);
});
route('GET', '/api/v1/oauth-configs/:id/redirects', (_req, { id }) => {
  const config = oauthConfigs.find((c) => c.id === id) as any;
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

// ---- app-behaviors ----
route('GET', '/api/v1/app-behaviors', () => ok(appBehaviors.map(({ config: _c, ...rest }: any) => rest)));
route('GET', '/api/v1/app-behaviors/:id', (_req, { id }) => {
  const behavior = appBehaviors.find((b) => b.id === id);
  if (!behavior) return fail(404, 'Behavior not found', 'app_behaviors.get.not_found');
  return ok(behavior);
});
route('PUT', '/api/v1/app-behaviors/:id', async (req, { id }) => {
  const behavior = appBehaviors.find((b) => b.id === id);
  if (!behavior) return fail(404, 'Behavior not found', 'app_behaviors.update.not_found');
  Object.assign(behavior, await readBody(req), { updated_at: new Date().toISOString() });
  return ok(behavior);
});
function setBehaviorActive(code: string, active: boolean) {
  const behavior = appBehaviors.find((b) => b.behavior_code === code);
  if (behavior) (behavior as any).is_active = active;
  return behavior ?? null;
}
route('POST', '/api/v1/app-behaviors/email/magic-link/activate', () => ok(setBehaviorActive('magic_link', true)));
route('POST', '/api/v1/app-behaviors/email/magic-link/deactivate', () => ok(setBehaviorActive('magic_link', false)));
route('POST', '/api/v1/app-behaviors/email/verification/activate', () => ok(setBehaviorActive('email_auth', true)));
route('POST', '/api/v1/app-behaviors/email/verification/deactivate', () => ok(setBehaviorActive('email_auth', false)));
route('POST', '/api/v1/app-behaviors/email/metadata-schema/activate', async (req) => {
  const behavior = setBehaviorActive('metadata_schema', true);
  if (behavior) (behavior as any).config = { schema: (await readBody(req)).schema ?? {} };
  return ok(behavior);
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
  const blocked = emailBlocklist.some((e: any) => e.email === email);
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
