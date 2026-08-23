export interface App {
  id: string;
  name: string;
  image?: string;
  created_at: string;
}

export interface LoginMethodDetails {
  id: string;
  email?: string;
  app_id?: string;
  created_at?: string;
  platform?: string; // OAuth provider: google, apple, microsoft, etc.
}

export interface LoginMethod {
  id: string;
  entity_type: string;
  entity_id: string;
  is_verify: boolean;
  user_id: string;
  details?: LoginMethodDetails;
}

export interface RoleDetails {
  id: string;
  name: string;
  description: string;
}

export interface User {
  id: string;
  name: string;
  user_name: string;
  app_id: string;
  role_id: string;
  created_at: string;
  updated_at: string;
  role_details?: RoleDetails;
  login_methods?: LoginMethod[];
  metadata?: Record<string, unknown>;
}

export interface MetadataFieldSchema {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  format?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  min_length?: number;
  max_length?: number;
}

export interface MetadataSchemaConfig {
  enabled: boolean;
  scheme: MetadataFieldSchema[];
  additional_properties: boolean;
}

export interface WebhookItem {
  id: string;
  name: string;
  description?: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  retries: number;
  app_id: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookEvent {
  code: string;
  description: string;
  category: string;
}

export interface EventsByCategory {
  [category: string]: WebhookEvent[];
}

export interface EnvVar {
  key: string;
  value: string;
  sensitive: boolean;
  category: string;
}

export interface AppBehavior {
  id: string;
  app_id: string;
  behavior_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppBehaviorDetail extends AppBehavior {
  config: Record<string, unknown>;
  created_by: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  app_id: string;
  users_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  effect: string;
  app_id: string;
  created_at: string;
  updated_at: string;
}

export interface APIKeyListItem {
  id: string;
  name: string;
  description?: string;
  app_id: string;
  key_id: string;
  publishable_key: string;
  is_active: boolean;
  environment: string;
  last_used_at?: string;
  revoked_at?: string;
  created_at: string;
  updated_at: string;
}

/** Whitelist redirect target (API: redirect_urls, auth_type oauth). */
export interface OAuthRedirectItem {
  url: string;
  platform: 'web' | 'android' | 'ios' | 'desktop';
  name?: string;
  rt?: string;
  legacy?: boolean;
}

/** Email access policy (GET/PUT /email-access/settings). */
export interface EmailAccessSettingsView {
  app_id: string;
  signup_access_mode: string;
  evaluate_blocklist_on_login: boolean;
  created_at?: string;
  updated_at?: string;
}

/** One allowlist or blocklist row. */
export interface EmailAccessEntryView {
  id: string;
  app_id: string;
  list_kind: string;
  /** all | email | oauth provider id (google, apple, …) */
  access_segment: string;
  entry_type: string;
  value_normalized: string;
  note?: string;
  created_at: string;
  updated_at: string;
}

export interface OAuthConfig {
  id: string;
  app_id: string;
  provider: string;
  name?: string;
  client_id: string;
  callback_key: string;
  callback_uri: string;
  scopes?: string;
  enabled: boolean;
  redirect_uri_web: string;
  redirect_uri_android?: string;
  redirect_uri_ios?: string;
  redirect_uri_desktop?: string;
  redirects?: OAuthRedirectItem[];
}

export type OAuthNativePlatform = 'ios' | 'android' | 'web';

/** Whitelisted JWT `aud` accepted for `POST /auth/social` (native SDK login). */
export interface OAuthNativeAudience {
  id: string;
  oauth_config_id: string;
  app_id: string;
  platform: OAuthNativePlatform;
  audience: string;
  label?: string;
  created_at?: string;
}
