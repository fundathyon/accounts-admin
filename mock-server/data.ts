// In-memory fixture store for the mock accounts backend. Shapes are modeled on the
// real Go entities (RoleEntity, UserEntity, AppEntity, APIKeyEntity, WebhookEntity,
// OAuthConfigListItem, PolicyEntity, AppBehaviorBasicDTO) — see mock-server/README.md.

// Starts well above every hardcoded seed id below (roles 1001-1003, policies 2001-2003,
// users 3001-3003, keys 4001-4002, webhooks 5001-5002, oauth 6001-6002, audiences 7001,
// behaviors 8001-8003, blocklist/allowlist 9001/9101) so generated ids can never collide
// with a seed — a shared counter starting at 1000 previously handed out "role_1001",
// silently colliding with the seeded "default" role's id.
let seq = 100000;
export function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}_${seq}`;
}

const now = () => new Date().toISOString();

export const APP_ID = 'app_mock_0001';

// Seeded so the admin is usable the moment `make dev-mock` comes up. The frontend
// gets its matching key from NEXT_PUBLIC_DEV_SECRET_KEY (.envs/.env.mock) rather
// than from onboarding, because onboarding only runs while zero apps exist — once
// any browser completes it, every *other* browser would be stuck with no key and
// no way to obtain one (localStorage is per-browser).
//
// Set MOCK_NO_APPS=1 to start empty instead, which is how you exercise the
// onboarding screen itself.
export const apps: Record<string, unknown>[] = process.env.MOCK_NO_APPS
  ? []
  : [
      {
        id: APP_ID,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        name: 'Mock App',
        image: '',
        root_user_id: 'user_root_0001',
        root_email: 'root@example.com',
      },
    ];

export const roles: Record<string, unknown>[] = [
  { id: 'role_1001', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', name: 'default', description: 'Full access role', app_id: APP_ID, users_count: 3 },
  { id: 'role_1002', created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z', name: 'support', description: 'Read-only support access', app_id: APP_ID, users_count: 2 },
  { id: 'role_1003', created_at: '2026-01-03T00:00:00Z', updated_at: '2026-01-03T00:00:00Z', name: 'billing', description: 'Billing and invoices', app_id: APP_ID, users_count: 1 },
];

export const policies: Record<string, unknown>[] = [
  { id: 'policy_2001', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', name: 'users.read', description: 'Read users', resource: 'user', action: 'read', effect: 'allow', app_id: APP_ID },
  { id: 'policy_2002', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', name: 'users.write', description: 'Create/update users', resource: 'user', action: 'update', effect: 'allow', app_id: APP_ID },
  { id: 'policy_2003', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', name: 'billing.deny', description: 'Block billing access', resource: 'billing', action: 'read', effect: 'deny', app_id: APP_ID },
];

export const rolePolicies: Record<string, string[]> = {
  role_1001: ['policy_2001', 'policy_2002'],
  role_1002: ['policy_2001'],
  role_1003: ['policy_2003'],
};

export const users: Record<string, unknown>[] = [
  {
    id: 'user_3001', created_at: '2026-01-05T00:00:00Z', updated_at: '2026-01-05T00:00:00Z',
    name: 'Ada Lovelace', user_name: 'ada', role_id: 'role_1001', app_id: APP_ID,
    totp_enabled: false, metadata: { department: 'Engineering' },
    role_details: roles[0],
    login_methods: [{ id: 'lm_1', entity_type: 'email', entity_id: 'ada@example.com', is_verify: true, is_active: true, user_id: 'user_3001', app_id: APP_ID }],
  },
  {
    id: 'user_3002', created_at: '2026-01-06T00:00:00Z', updated_at: '2026-01-06T00:00:00Z',
    name: 'Grace Hopper', user_name: 'grace', role_id: 'role_1002', app_id: APP_ID,
    totp_enabled: true, metadata: {},
    role_details: roles[1],
    login_methods: [{ id: 'lm_2', entity_type: 'email', entity_id: 'grace@example.com', is_verify: true, is_active: true, user_id: 'user_3002', app_id: APP_ID }],
  },
  {
    id: 'user_3003', created_at: '2026-01-07T00:00:00Z', updated_at: '2026-01-07T00:00:00Z',
    name: 'Alan Turing', user_name: 'alan', role_id: 'role_1003', app_id: APP_ID,
    totp_enabled: false, metadata: {},
    role_details: roles[2],
    login_methods: [{ id: 'lm_3', entity_type: 'oauth', entity_id: 'google:alan', is_verify: false, is_active: true, user_id: 'user_3003', app_id: APP_ID }],
  },
];

export const apiKeys: Record<string, unknown>[] = [
  { id: 'key_4001', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', name: 'Server key', description: 'Backend integration', app_id: APP_ID, key_id: 'key_4001', publishable_key: 'pk_test_mock0001', is_active: true, environment: 'test', last_used_at: null, revoked_at: null },
  { id: 'key_4002', created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z', name: 'CI key', description: 'CI pipeline', app_id: APP_ID, key_id: 'key_4002', publishable_key: 'pk_test_mock0002', is_active: false, environment: 'test', last_used_at: null, revoked_at: '2026-02-01T00:00:00Z' },
];

export const webhooks: Record<string, unknown>[] = [
  { id: 'wh_5001', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', name: 'User events', description: '', app_id: APP_ID, url: 'https://example.com/hooks/users', secret: 'whsec_mock0001', events: ['accounts.user.signup', 'accounts.user.deleted'], active: true, retries: 3 },
  { id: 'wh_5002', created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z', name: 'Auth events', description: '', app_id: APP_ID, url: 'https://example.com/hooks/auth', secret: 'whsec_mock0002', events: ['accounts.auth.signin', 'accounts.auth.signout'], active: false, retries: 3 },
];

export const webhookEvents: Record<string, { code: string; description: string; category: string }[]> = {
  User: [
    { code: 'accounts.user.signup', description: 'A user signed up', category: 'User' },
    { code: 'accounts.user.deleted', description: 'A user was deleted', category: 'User' },
  ],
  Auth: [
    { code: 'accounts.auth.signin', description: 'A user signed in', category: 'Auth' },
    { code: 'accounts.auth.signout', description: 'A user signed out', category: 'Auth' },
  ],
  'Role & Policy': [
    { code: 'accounts.role.created', description: 'A role was created', category: 'Role & Policy' },
  ],
  OAuth: [
    { code: 'accounts.oauth.linked', description: 'An OAuth provider was linked', category: 'OAuth' },
  ],
};

export const oauthConfigs: Record<string, unknown>[] = [
  {
    id: 'oauth_6001', app_id: APP_ID, provider: 'google', name: 'Google', client_id: 'mock-google-client-id.apps.googleusercontent.com',
    callback_key: 'cb_mock_google', callback_uri: 'http://localhost:3000/api/oauth/callback/google', scopes: 'openid email profile',
    enabled: true, redirect_uri_web: 'http://localhost:3000/auth/callback', redirect_uri_android: '', redirect_uri_ios: '', redirect_uri_desktop: '',
    redirects: [],
  },
  {
    id: 'oauth_6002', app_id: APP_ID, provider: 'github', name: 'GitHub', client_id: 'mock-github-client-id',
    callback_key: 'cb_mock_github', callback_uri: 'http://localhost:3000/api/oauth/callback/github', scopes: 'read:user user:email',
    enabled: false, redirect_uri_web: '', redirect_uri_android: '', redirect_uri_ios: '', redirect_uri_desktop: '',
    redirects: [],
  },
];

export const oauthAudiences: Record<string, Record<string, unknown>[]> = {
  oauth_6001: [
    { id: 'aud_7001', oauth_config_id: 'oauth_6001', app_id: APP_ID, platform: 'web', audience: 'mock-google-client-id.apps.googleusercontent.com', label: 'Web', created_at: now() },
  ],
  oauth_6002: [],
};

export const appBehaviors: Record<string, unknown>[] = [
  { id: 'beh_8001', app_id: APP_ID, behavior_code: 'email_auth', is_active: true, config: {
    require_verification: true,
    identifier: 'email',
    metadata_schema: {
      enabled: true,
      additional_properties: true,
      scheme: [
        { name: 'plan', type: 'string', required: false, enum: ['free', 'pro', 'enterprise'] },
        { name: 'seats', type: 'number', required: false, minimum: 1, maximum: 500 },
        { name: 'phone', type: 'string', required: false, format: '[0-9]{10}' },
      ],
    },
  }, created_by: 'system', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'beh_8002', app_id: APP_ID, behavior_code: 'magic_link', is_active: false, config: {}, created_by: 'system', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'beh_8003', app_id: APP_ID, behavior_code: 'metadata_schema', is_active: false, config: { schema: {} }, created_by: 'system', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
];

// The access_token policy of user_metadata (Pro): `plan` and `seats` go in the token.
export const userMetadataPolicy = { enabled: true, allowed_keys: ['plan', 'seats'], include_user_writable: false };

export const emailAccessSettings = {
  mode: 'allowlist_and_blocklist',
  default_action: 'allow',
};

export const emailBlocklist: Record<string, unknown>[] = [
  { id: 'blk_9001', app_id: APP_ID, email: 'spam@blocked.example.com', reason: 'Spam signup', created_at: '2026-01-01T00:00:00Z' },
];

export const emailAllowlist: Record<string, unknown>[] = [
  { id: 'alw_9101', app_id: APP_ID, email: '*@trusted-partner.example.com', created_at: '2026-01-01T00:00:00Z' },
];

export function paginate<T>(items: T[], page: number, size: number): { slice: T[]; total: number } {
  const start = page * size;
  return { slice: items.slice(start, start + size), total: items.length };
}

// ---- security behaviors ----
// Each one has its own endpoint in the backend (the generic /app-behaviors
// routes refuse them), so they live apart from `appBehaviors`.

export const mfaBehavior = {
  mode: 'optional',
  flows: ['password', 'oauth', 'native', 'magic_link', 'email_code'],
  updated_at: '2026-09-12T10:30:00Z',
};

export const identityLinkingBehavior = { mode: 'link_with_proof', updated_at: '2026-09-12T10:30:00Z' };

// An app that predates the setting: it keeps the legacy values and still gets
// tokens in the URL, so the screen shows what is pending to migrate.
export const sessionSecurityBehavior = {
  oauth_token_delivery: 'query',
  refresh_rotation: false,
  revoke_sessions_on_password_change: true,
  updated_at: '2026-08-02T16:05:00Z',
};

export const queryDeliveryUsage = { last_used_at: '2026-11-03T17:42:10Z', uses_last_30d: 412, window_days: 30 };

export const sessionSecurityDefaults = {
  oauth_token_delivery: 'code',
  refresh_rotation: true,
  revoke_sessions_on_password_change: true,
};

// The instance's defaults (AUTH_RATE_LIMIT_*, AUTH_LOCKOUT_*, API_KEY_FAILURE_*,
// MFA_*); `securityLimitsOverrides` is what the app set (null = inherit).
export const securityLimitsDefaults = {
  rate_limit: { ip_max: 60, ip_window_sec: 60, account_max: 10, account_window_sec: 900 },
  lockout: { threshold: 10, window_sec: 900, durations_sec: [60, 300, 900], reset_sec: 86400 },
  api_keys: { failure_max: 10, failure_window_sec: 300 },
  mfa: { token_ttl_sec: 300, max_attempts: 5, failure_max: 10, failure_window_sec: 900 },
};

export const securityLimitsOverrides: Record<string, Record<string, number | number[] | null>> = {
  rate_limit: { ip_max: 120, ip_window_sec: null, account_max: null, account_window_sec: null },
  lockout: { threshold: 8, window_sec: null, durations_sec: null, reset_sec: null },
  api_keys: { failure_max: null, failure_window_sec: null },
  mfa: { token_ttl_sec: null, max_attempts: null, failure_max: null, failure_window_sec: null },
};

export const securityLimitsMeta = { updated_at: '2026-10-21T09:15:00Z' };

// Same table as securitylimits.Ranges in the backend.
export const securityLimitsRanges: Record<string, { min: number; max: number; min_items?: number; max_items?: number }> = {
  'rate_limit.ip_max': { min: 5, max: 1000 },
  'rate_limit.ip_window_sec': { min: 10, max: 3600 },
  'rate_limit.account_max': { min: 3, max: 100 },
  'rate_limit.account_window_sec': { min: 60, max: 86400 },
  'lockout.threshold': { min: 3, max: 100 },
  'lockout.window_sec': { min: 60, max: 86400 },
  'lockout.reset_sec': { min: 3600, max: 604800 },
  'lockout.durations_sec': { min: 10, max: 86400, min_items: 1, max_items: 5 },
  'api_keys.failure_max': { min: 3, max: 100 },
  'api_keys.failure_window_sec': { min: 60, max: 3600 },
  'mfa.token_ttl_sec': { min: 60, max: 900 },
  'mfa.max_attempts': { min: 1, max: 10 },
  'mfa.failure_max': { min: 3, max: 50 },
  'mfa.failure_window_sec': { min: 60, max: 86400 },
};

export const geoAccessBehavior = {
  id: 'beh_8101',
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
  config: { mode: 'blocklist', countries: ['KP', 'RU'], unknown_country: 'allow' },
};

// ---- login events: a realistic 90-day history (Community and Pro) ----

const LOGIN_PLACES = [
  { country_code: 'MX', country_name: 'Mexico', region: 'Jalisco', city: 'Guadalajara', ip: '187.190.14.22', geo_source: 'database' },
  { country_code: 'MX', country_name: 'Mexico', region: 'Ciudad de México', city: 'Ciudad de México', ip: '201.141.8.77', geo_source: 'database' },
  { country_code: 'ES', country_name: 'Spain', region: 'Madrid', city: 'Madrid', ip: '83.46.120.9', geo_source: 'database' },
  { country_code: 'US', country_name: 'United States', region: 'California', city: 'San Francisco', ip: '104.28.3.41', geo_source: 'headers' },
  { country_code: 'XX', country_name: '', region: '', city: '', ip: '10.0.4.18', geo_source: 'none' },
];
const LOGIN_DEVICES = [
  { device_name: 'Chrome en macOS', user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36' },
  { device_name: 'Safari en iPhone', user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1' },
  { device_name: 'Firefox en Windows', user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0' },
];
const FAILURE_REASONS = ['bad_password', 'unknown_account', 'rate_limited', 'mfa_failed', 'code_invalid'];
const LOGIN_USERS = ['user_3001', 'user_3002', 'user_3003'];

/** Recent first. Fixed spacing, so the same history comes back on every restart. */
export const loginEvents: Record<string, unknown>[] = Array.from({ length: 64 }, (_, i) => {
  const place = LOGIN_PLACES[i % LOGIN_PLACES.length]!;
  const device = LOGIN_DEVICES[i % LOGIN_DEVICES.length]!;
  const userId = LOGIN_USERS[i % LOGIN_USERS.length]!;
  const createdAt = new Date(Date.now() - i * 33 * 60 * 60 * 1000).toISOString();
  const base = { id: `evt_${10000 + i}`, app_id: APP_ID, ...place, ...device, created_at: createdAt };
  if (i % 11 === 7) return { ...base, type: 'login_blocked', method: 'password', block_reason: place.country_code === 'XX' ? 'unknown_country' : 'country_not_allowed' };
  if (i % 7 === 3) {
    const reason = FAILURE_REASONS[i % FAILURE_REASONS.length]!;
    return { ...base, type: 'login_failed', method: 'password', block_reason: reason, ...(reason === 'unknown_account' ? {} : { user_id: userId }) };
  }
  if (i % 9 === 5) return { ...base, type: 'ip_changed', user_id: userId, session_id: `ses_${20000 + i}` };
  const oauth = i % 5 === 1;
  return {
    ...base, type: 'login_succeeded', user_id: userId, session_id: `ses_${20000 + i}`,
    method: oauth ? 'oauth' : i % 5 === 2 ? 'magic_link' : 'password', ...(oauth ? { provider: 'google' } : {}),
  };
});

// ---- MCP Connect: both editions (the backend only asks for OAUTH_PUBLIC_URL) ----

const MCP_ISSUER = `https://auth.example.com/o/${APP_ID}`;

export function mcpResourceUrls(resourceUrl: string) {
  return {
    issuer: MCP_ISSUER,
    metadata_url: `${MCP_ISSUER}/.well-known/oauth-authorization-server`,
    jwks_url: `${MCP_ISSUER}/.well-known/jwks.json`,
    protected_resource_metadata_url: `${new URL(resourceUrl).origin}/.well-known/oauth-protected-resource`,
  };
}

function mcpScope(resourceId: string, key: string, label: string, is_write = false, is_default = true) {
  return { id: `${resourceId}_${key}`, resource_id: resourceId, key, label, description: '', is_write, is_default, roles: [] };
}

export const mcpResources: Record<string, unknown>[] = [
  {
    id: 'mcp_11001', app_id: APP_ID, name: 'Pedidos MCP', resource_url: 'https://api.example.com/mcp', login_url: 'https://app.example.com/conectar',
    access_ttl_seconds: 3600, cimd_enabled: true, dcr_enabled: true, allowed_redirect_domains: ['claude.ai', 'chatgpt.com'], allowed_client_domains: [],
    scopes: [mcpScope('mcp_11001', 'orders:read', 'Ver tus pedidos'), mcpScope('mcp_11001', 'orders:write', 'Crear y cancelar pedidos', true, false)],
    ...mcpResourceUrls('https://api.example.com/mcp'),
    verified_at: '2026-10-20T09:12:00Z',
    verify_report: {
      verified: true, at: '2026-10-20T09:12:00Z',
      checks: ['reachable', 'challenge_401', 'metadata_fetched', 'resource_matches', 'authorization_server_matches'].map((name) => ({ name, status: 'passed' })),
    },
    created_at: '2026-10-18T15:40:00Z', updated_at: '2026-10-20T09:12:00Z',
  },
  {
    id: 'mcp_11002', app_id: APP_ID, name: 'Soporte MCP', resource_url: 'https://support.example.com/mcp', login_url: 'https://app.example.com/conectar-soporte',
    access_ttl_seconds: 7200, cimd_enabled: true, dcr_enabled: false, allowed_redirect_domains: ['claude.ai'], allowed_client_domains: [],
    scopes: [mcpScope('mcp_11002', 'tickets:read', 'Ver tus tickets')],
    ...mcpResourceUrls('https://support.example.com/mcp'),
    verified_at: null, created_at: '2026-10-29T11:05:00Z', updated_at: '2026-10-29T11:05:00Z',
  },
];

export const mcpConnections: Record<string, unknown>[] = [
  {
    id: 'mcpc_12001', resource: { id: 'mcp_11001', name: 'Pedidos MCP', resource_url: 'https://api.example.com/mcp' },
    client: { client_id: 'https://claude.ai/oauth/mcp-client', kind: 'cimd', name: 'Claude' }, user_id: 'user_3001',
    user: { id: 'user_3001', email: 'ada@example.com', name: 'Ada Lovelace' }, session_id: 'ses_30001', scope: ['orders:read', 'orders:write'], status: 'active',
    granted_at: '2026-10-21T10:00:00Z', last_used_at: '2026-11-04T18:22:00Z', revoked_at: null,
  },
  {
    id: 'mcpc_12002', resource: { id: 'mcp_11001', name: 'Pedidos MCP', resource_url: 'https://api.example.com/mcp' },
    client: { client_id: 'mcp_c_chatgpt', kind: 'dcr', name: 'ChatGPT' }, user_id: 'user_3002',
    user: { id: 'user_3002', email: 'grace@example.com', name: 'Grace Hopper' }, session_id: 'ses_30002', scope: ['orders:read'], status: 'revoked',
    granted_at: '2026-10-22T08:30:00Z', last_used_at: '2026-10-25T12:00:00Z', revoked_at: '2026-10-26T09:00:00Z', revoked_reason: 'user',
  },
];

// ---- Email templates: same catalog and themes as templates/catalog in the backend ----
export const emailCatalogMeta = {
  version: '3.0.0',
  channel: 'stable',
  allowed_globals: ['app_name', 'logo_url', 'support_email', 'year', 'current_date', 'unsubscribe_url'],
  forbidden_variables: ['password', 'secret_key', 'refresh_token', 'jwt', 'api_key', 'access_token', 'private_key', 'pepper', 'token_hash'],
};

function emailEntry(id: string, name: string, description: string, category: string, subject: string, required: string[], optional: string[], safe?: string[]) {
  return {
    id, name, description, category,
    subject_default: subject,
    from_name_default: '{app_name}',
    required_variables: required,
    optional_variables: optional,
    ...(safe ? { safe_html_variables: safe } : {}),
    baseline_ref: `embedded:${id}@${emailCatalogMeta.version}`,
  };
}

export type EmailCatalogEntry = ReturnType<typeof emailEntry>;

export const emailCatalog = [
  emailEntry('signup_activation_code', 'Sign-up: activation code', 'Sends a numeric verification code to confirm a new email registration.', 'auth', 'Verify your account at {app_name}', ['activation_code', 'expiry_minutes', 'app_name'], ['user_name', 'logo_url', 'support_email']),
  emailEntry('signup_activation_link', 'Sign-up: activation link', 'Sends a one-tap verification link instead of a numeric code.', 'auth', 'Activate your account at {app_name}', ['activation_url', 'expiry_minutes', 'app_name'], ['user_name', 'logo_url', 'support_email', 'button_color'], ['activation_url']),
  emailEntry('passwordless_otp', 'Passwordless OTP', 'One-time login code for passwordless authentication.', 'auth', 'Your one-time code for {app_name}', ['otp_code', 'expiry_minutes', 'app_name'], ['user_name', 'logo_url']),
  emailEntry('password_reset_code', 'Password reset: code', 'Sends a numeric reset code to recover an account password.', 'reset', 'Reset your {app_name} password', ['reset_password_code', 'expiry_minutes', 'app_name'], ['user_name', 'logo_url', 'support_email']),
  emailEntry('password_reset_link', 'Password reset: link', 'Sends a one-tap link to set a new password.', 'reset', 'Reset your {app_name} password', ['reset_url', 'expiry_minutes', 'app_name'], ['user_name', 'logo_url', 'support_email', 'button_color'], ['reset_url']),
  emailEntry('change_email_code', 'Change email: verification code', 'Verifies the new email address before swapping it on the account.', 'account', 'Confirm your new email at {app_name}', ['activation_code', 'new_email', 'expiry_minutes', 'app_name'], ['user_name', 'logo_url', 'support_email']),
  emailEntry('welcome', 'Welcome', 'Greets the user right after they verify their account.', 'account', 'Welcome to {app_name}', ['app_name'], ['user_name', 'logo_url', 'support_email']),
  emailEntry('magic_link', 'Magic link sign-in', 'Passwordless login link with optional per-app branding.', 'auth', 'Your sign-in link for {app_name}', ['magic_url', 'expiry_minutes', 'app_name'], ['user_name', 'logo_url', 'button_color', 'support_email'], ['magic_url']),
  emailEntry('totp_enabled_notice', 'Security: 2FA enabled', 'Notifies the user that two-factor authentication was just enabled.', 'security', 'Two-factor authentication enabled on your {app_name} account', ['app_name', 'event_at', 'ip'], ['user_name', 'user_agent', 'support_url', 'logo_url']),
  emailEntry('password_changed_notice', 'Security: password changed', 'Notifies the user that their account password was just changed.', 'security', 'Your {app_name} password was changed', ['app_name', 'event_at', 'ip'], ['user_name', 'user_agent', 'support_url', 'logo_url']),
];

function emailTheme(
  id: string, name: string, description: string, palette: [string, string, string, string, string, string, string],
  options: { headingFont?: string; corners: string; align: string; topBar?: boolean; dark?: boolean },
) {
  const [canvas, surface, border, heading, text, muted, accent] = palette;
  return {
    id, name, description,
    bg_color: surface, accent_color: accent, text_color: heading, is_dark: !!options.dark,
    tokens: {
      canvas, surface, border, heading, text, muted, accent,
      font: 'sans', heading_font: options.headingFont ?? 'sans', corners: options.corners, align: options.align,
      top_bar: !!options.topBar, dark: !!options.dark,
    },
  };
}

export type EmailThemeEntry = ReturnType<typeof emailTheme>;

export const DEFAULT_EMAIL_THEME = 'midnight';

// Default first, then by id, like catalog.ListThemes.
export const emailThemes = [
  emailTheme('midnight', 'Midnight Cyan', 'Near-black canvas with a cyan accent. Crisp and technical, made for developer tools.', ['#0a0c0f', '#12161b', '#232a33', '#f5f7fa', '#c3cad3', '#828c98', '#3bc7cb'], { corners: 'soft', align: 'left', dark: true }),
  emailTheme('daylight', 'Daylight Minimal', 'White card on a soft grey canvas with a confident blue accent. A safe default for B2B SaaS.', ['#f3f4f6', '#ffffff', '#e5e7eb', '#0f172a', '#374151', '#6b7280', '#2563eb'], { corners: 'soft', align: 'left' }),
  emailTheme('forest', 'Forest', 'Deep green and dark with a bright lime accent. Calm and grounded.', ['#07130d', '#0d1d15', '#1d3427', '#ecfdf3', '#bcd5c4', '#7f9c8a', '#84cc16'], { corners: 'soft', align: 'center', dark: true }),
  emailTheme('ocean_teal', 'Ocean Teal', 'Mint canvas, white card and a teal accent. Friendly, light and calm.', ['#e8f6f3', '#ffffff', '#cde8e2', '#0b3b36', '#2c5a54', '#5f817b', '#0d9488'], { corners: 'round', align: 'center' }),
  emailTheme('royal_purple', 'Royal Purple', 'Cream paper, serif headings and a deep purple accent. Premium and editorial.', ['#f6f1e8', '#fffdf8', '#e7ddcb', '#23103d', '#4a3b5f', '#8a7d9c', '#6d28d9'], { headingFont: 'serif', corners: 'sharp', align: 'center', topBar: true }),
  emailTheme('slate_mono', 'Slate Mono', "Monochrome and corporate. Sharp edges and no colour but your brand's.", ['#fafafa', '#ffffff', '#e4e4e7', '#09090b', '#3f3f46', '#71717a', '#18181b'], { corners: 'sharp', align: 'left' }),
  emailTheme('sunrise', 'Sunrise Warm', 'Warm peach canvas, rounded shapes and an orange accent. Great for consumer apps.', ['#fff4ea', '#ffffff', '#fbdcc4', '#3b1d08', '#5f3b22', '#9b7458', '#ea580c'], { corners: 'round', align: 'center', topBar: true }),
];
