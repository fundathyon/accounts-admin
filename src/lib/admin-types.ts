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
}
