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
  { id: 'beh_8001', app_id: APP_ID, behavior_code: 'email_auth', is_active: true, config: { require_verification: true }, created_by: 'system', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'beh_8002', app_id: APP_ID, behavior_code: 'magic_link', is_active: false, config: {}, created_by: 'system', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'beh_8003', app_id: APP_ID, behavior_code: 'metadata_schema', is_active: false, config: { schema: {} }, created_by: 'system', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
];

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
