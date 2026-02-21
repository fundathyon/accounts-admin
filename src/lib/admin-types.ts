export interface App {
  id: string;
  name: string;
  created_at: string;
}

export interface LoginMethodDetails {
  id: string;
  email?: string;
  app_id?: string;
  created_at?: string;
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
