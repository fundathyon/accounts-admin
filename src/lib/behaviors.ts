import type { MetadataSchemaConfig } from './admin-types';

/**
 * Contract of the `email_auth` behavior and of the other behaviors, as the Go
 * backend defines it (`internal/context/v1/app_behaviors`, and the DTOs of
 * `internal/api/v1/app_behaviors/interface/dtos`). Imported by the mock server
 * by relative path: no `@/` imports here.
 */

export interface EmailBrandingConfig {
  from_name?: string;
  subject?: string;
  logo_url?: string;
  button_color?: string;
}

export type CodeStrategy = 'random' | 'fixed';
export type EmailCodeType = 'numeric' | 'alphanumeric' | 'alphanumeric_special';

export interface EmailCodeConfig {
  enabled?: boolean;
  auto_signup?: boolean;
  code_size?: number;
  code_type?: string;
  code_strategy?: string;
  fixed_code?: string;
  ttl_seconds?: number;
  max_verify_attempts?: number;
  window_seconds?: number;
  max_attempts_per_window?: number;
  resend_cooldown_seconds?: number;
  single_active_code?: boolean;
  bind_to_ip?: boolean;
  bind_to_user_agent?: boolean;
  email_branding?: EmailBrandingConfig;
}

export interface SessionsConfig {
  refresh_rotation?: boolean;
  reuse_interval_seconds?: number;
  idle_timeout_seconds?: number;
}

export interface MagicLinkConfig {
  bind_to_ip?: boolean;
  bind_to_user_agent?: boolean;
  enabled?: boolean;
  max_attempts_per_window?: number;
  single_use?: boolean;
  ttl_seconds?: number;
  window_seconds?: number;
  auto_signup?: boolean;
  redirect_base_url?: string;
  default_redirect_path?: string;
  email_branding?: EmailBrandingConfig;
}

export interface EmailAuthConfig {
  identifier?: string;
  email?: {
    allow_plus_alias?: boolean;
    enabled?: boolean;
    normalize?: { lowercase?: boolean; trim?: boolean };
  };
  magic_link?: MagicLinkConfig;
  email_code?: EmailCodeConfig;
  password?: {
    enabled?: boolean;
    policy?: {
      deny_common_passwords?: boolean;
      /** Absent on a backend that predates the breached-password check. */
      check_breached?: boolean;
      max_length?: number;
      min_digits?: number;
      min_length?: number;
      min_lowercase?: number;
      min_special_char?: number;
      min_uppercase?: number;
      special_chars?: string[];
    };
  };
  verification?: {
    code_size?: number;
    code_type?: string;
    enabled?: boolean;
    mode?: string;
    ttl_seconds?: number;
    code_strategy?: CodeStrategy;
    fixed_code?: string;
  };
  testers?: { enabled?: boolean };
  sessions?: SessionsConfig;
  metadata_schema?: MetadataSchemaConfig;
}

/** `codegen.AllowedFixedCodeEnvironments`: fixed codes are refused anywhere else. */
export const FIXED_CODE_ALLOWED_ENVS = ['local', 'development', 'staging', 'qa', 'test'] as const;

/** Reserved domain of the test users; fixed in the backend. */
export const TESTER_DOMAIN = 'getfoundathyon.mock';

/** `email_entities.EmailCode*` limits, enforced by `POST /email/email-code/activate`. */
export const EMAIL_CODE_LIMITS = {
  size: { min: 4, max: 12 },
  ttl: { min: 60, max: 3600 },
  attempts: { min: 1, max: 20 },
  cooldownMax: 3600,
};

/** What the backend applies to a field missing from the `email_code` node. */
export const EMAIL_CODE_DEFAULTS = {
  enabled: false,
  auto_signup: true,
  code_size: 6,
  code_type: 'numeric',
  code_strategy: 'random',
  ttl_seconds: 600,
  max_verify_attempts: 5,
  window_seconds: 600,
  max_attempts_per_window: 5,
  resend_cooldown_seconds: 60,
  single_active_code: true,
  bind_to_ip: false,
  bind_to_user_agent: false,
} satisfies EmailCodeConfig;

/** `rt_entities` limits, enforced by `POST /email/sessions/activate`. */
export const SESSIONS_LIMITS = {
  reuseMax: 300,
  idle: { min: 3600, max: 31536000 },
};

/** `DefaultSessionsConfig`: an app without the node never rotates. */
export const SESSIONS_DEFAULTS = {
  refresh_rotation: false,
  reuse_interval_seconds: 30,
  idle_timeout_seconds: 0,
} satisfies SessionsConfig;

/** `ExtractMetadataSchemaConfig`: an app without the node accepts any metadata. */
export const METADATA_SCHEMA_DEFAULTS: MetadataSchemaConfig = {
  enabled: false,
  scheme: [],
  additional_properties: true,
};

export function withEmailCodeDefaults(node?: EmailCodeConfig): EmailCodeConfig {
  return { ...EMAIL_CODE_DEFAULTS, ...node };
}

export function withSessionsDefaults(node?: SessionsConfig): SessionsConfig {
  return { ...SESSIONS_DEFAULTS, ...node };
}

// The alphabets of `codegen.AlphabetFor`, through `EmailCodeConfig.CodegenType`.
const EMAIL_CODE_ALPHABET_UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const EMAIL_CODE_ALPHABETS: Record<string, string> = {
  numeric: '0123456789',
  alphanumeric: EMAIL_CODE_ALPHABET_UPPER,
  alphanumeric_special: `${EMAIL_CODE_ALPHABET_UPPER}#$%&*+-=?@!`,
};

export const EMAIL_CODE_TYPES = Object.keys(EMAIL_CODE_ALPHABETS);

/** A value the backend would refuse. `key`/`params` are for the UI, `message` is the backend's text. */
export interface ConfigIssue {
  field: string;
  key: string;
  params?: Record<string, string | number>;
  message: string;
  /** Scope of the backend's answer, when it has its own. */
  scope?: string;
}

function outOfRange(value: number | undefined, min: number, max: number): boolean {
  return value !== undefined && (!Number.isInteger(value) || value < min || value > max);
}

function notPositive(value: number | undefined): boolean {
  return value !== undefined && (!Number.isInteger(value) || value <= 0);
}

/** `ActivateEmailAuthEmailCodeDTO.Validate` plus `validateEmailCodeFixedCode`, minus the environment check. */
export function validateEmailCode(node: EmailCodeConfig): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const add = (field: string, key: string, message: string, params?: ConfigIssue['params'], scope?: string) =>
    issues.push({ field, key, message, params, scope });
  const between = (field: string, value: number | undefined, { min, max }: { min: number; max: number }) => {
    if (outOfRange(value, min, max)) {
      add(field, 'emailAuth.errors.between', `${field} must be between ${min} and ${max}`, { min, max });
    }
  };
  const positive = (field: string, value: number | undefined) => {
    if (notPositive(value)) add(field, 'emailAuth.errors.positive', `${field} must be > 0`);
  };

  between('code_size', node.code_size, EMAIL_CODE_LIMITS.size);
  if (node.code_type !== undefined && !EMAIL_CODE_TYPES.includes(node.code_type)) {
    add('code_type', 'emailAuth.errors.invalidOption', 'code_type must be "numeric", "alphanumeric" or "alphanumeric_special"');
  }
  if (node.code_strategy !== undefined && node.code_strategy !== 'random' && node.code_strategy !== 'fixed') {
    add('code_strategy', 'emailAuth.errors.invalidOption', 'code_strategy must be "random" or "fixed"');
  }
  between('ttl_seconds', node.ttl_seconds, EMAIL_CODE_LIMITS.ttl);
  between('max_verify_attempts', node.max_verify_attempts, EMAIL_CODE_LIMITS.attempts);
  positive('window_seconds', node.window_seconds);
  positive('max_attempts_per_window', node.max_attempts_per_window);
  between('resend_cooldown_seconds', node.resend_cooldown_seconds, { min: 0, max: EMAIL_CODE_LIMITS.cooldownMax });

  if (node.code_strategy === 'fixed') {
    const fixed = (node.fixed_code ?? '').trim();
    const size = node.code_size ?? EMAIL_CODE_DEFAULTS.code_size;
    const alphabet = EMAIL_CODE_ALPHABETS[node.code_type ?? 'numeric'] ?? EMAIL_CODE_ALPHABETS.numeric;
    if (!fixed) {
      add(
        'fixed_code',
        'emailAuth.errors.fixedCodeRequired',
        'fixed_code is required when code_strategy is "fixed"',
        undefined,
        'app_behaviors.activate_email_code.fixed_code_required',
      );
    } else if (fixed.length !== size) {
      add(
        'fixed_code',
        'emailAuth.errors.fixedCodeLengthMismatch',
        `fixed_code length ${fixed.length} does not match code_size ${size}`,
        undefined,
        'app_behaviors.activate_email_code.fixed_code_length_mismatch',
      );
    } else if ([...fixed].some((c) => !alphabet.includes(c))) {
      add(
        'fixed_code',
        'emailAuth.errors.fixedCodeCharClassMismatch',
        `fixed_code contains characters that are not allowed for code_type "${node.code_type ?? 'numeric'}"`,
        undefined,
        'app_behaviors.activate_email_code.fixed_code_character_class_mismatch',
      );
    }
  }
  return issues;
}

/** `ActivateEmailAuthMagicLinkDTO.Validate`; empty URL fields are unset, not invalid. */
export function validateMagicLink(node: MagicLinkConfig): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const baseUrl = (node.redirect_base_url ?? '').trim();
  if (baseUrl) {
    let valid = false;
    try {
      const url = new URL(baseUrl);
      valid = (url.protocol === 'http:' || url.protocol === 'https:') && url.host !== '';
    } catch {
      valid = false;
    }
    if (!valid) {
      issues.push({
        field: 'redirect_base_url',
        key: 'emailAuth.errors.invalidBaseUrl',
        message: 'redirect_base_url must use http or https scheme and include a host',
      });
    }
  }
  const path = (node.default_redirect_path ?? '').trim();
  if (path && (!path.startsWith('/') || path.startsWith('//'))) {
    issues.push({
      field: 'default_redirect_path',
      key: 'emailAuth.errors.invalidRedirectPath',
      message: 'default_redirect_path must start with / and not with //',
    });
  }
  for (const field of ['ttl_seconds', 'window_seconds', 'max_attempts_per_window'] as const) {
    if (notPositive(node[field])) {
      issues.push({ field, key: 'emailAuth.errors.positive', message: `${field} must be > 0` });
    }
  }
  return issues;
}

/** `ActivateEmailAuthSessionsDTO.Validate`; the backend also asks for twice the access token's life. */
export function validateSessions(node: SessionsConfig): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const { reuseMax, idle } = SESSIONS_LIMITS;
  if (outOfRange(node.reuse_interval_seconds, 0, reuseMax)) {
    issues.push({
      field: 'reuse_interval_seconds',
      key: 'emailAuth.errors.between',
      params: { min: 0, max: reuseMax },
      message: `reuse_interval_seconds must be between 0 and ${reuseMax}`,
    });
  }
  const timeout = node.idle_timeout_seconds;
  if (timeout !== undefined && timeout !== 0 && outOfRange(timeout, idle.min, idle.max)) {
    issues.push({
      field: 'idle_timeout_seconds',
      key: 'emailAuth.errors.idleRange',
      params: { min: idle.min, max: idle.max },
      message: `idle_timeout_seconds must be 0 (no limit) or between ${idle.min} and ${idle.max}`,
    });
  }
  return issues;
}

/** Backend codes that map to a message of ours. */
export const BEHAVIOR_SCOPE_TO_I18N: Record<string, string> = {
  'app_behaviors.activate_verification.code_strategy_fixed_not_allowed_in_environment': 'emailAuth.errors.fixedNotAllowedHere',
  'app_behaviors.activate_verification.fixed_code_required': 'emailAuth.errors.fixedCodeRequired',
  'app_behaviors.activate_verification.fixed_code_length_mismatch': 'emailAuth.errors.fixedCodeLengthMismatch',
  'app_behaviors.activate_verification.fixed_code_character_class_mismatch': 'emailAuth.errors.fixedCodeCharClassMismatch',
  'app_behaviors.activate_email_code.code_strategy_fixed_not_allowed_in_environment': 'emailAuth.errors.fixedNotAllowedHere',
  'app_behaviors.activate_email_code.fixed_code_required': 'emailAuth.errors.fixedCodeRequired',
  'app_behaviors.activate_email_code.fixed_code_length_mismatch': 'emailAuth.errors.fixedCodeLengthMismatch',
  'app_behaviors.activate_email_code.fixed_code_character_class_mismatch': 'emailAuth.errors.fixedCodeCharClassMismatch',
  'app_behaviors.activate_sessions.idle_timeout_too_short': 'emailAuth.errors.idleTooShort',
};

export const COMMON_BEHAVIOR_SCREENS: Record<string, string> = {
  session_security: '/session-security',
  mfa: '/mfa',
  security_limits: '/security-limits',
  identity_linking: '/identity-linking',
};

/** Their routes exist only in Pro (`app_behaviors/setup.go`, `settings.IsProEdition()`). */
export const PRO_BEHAVIOR_SCREENS: Record<string, string> = {
  tokens: '/behaviors/tokens',
  embedded_auth: '/embedded-auth',
  geo_access: '/geo-access',
};

/** The behaviors with a screen of their own in this edition, as `[code, path]`. */
export function behaviorScreens(isPro: boolean): [string, string][] {
  return Object.entries({ ...COMMON_BEHAVIOR_SCREENS, ...(isPro ? PRO_BEHAVIOR_SCREENS : {}) });
}

/** The screen that edits a behavior, or null when `/behaviors/[id]` is the only one. */
export function behaviorScreen(code: string, isPro: boolean): string | null {
  return behaviorScreens(isPro).find(([c]) => c === code)?.[1] ?? null;
}

/**
 * Whether the generic `PUT /app-behaviors/:id` refuses the behavior
 * (`UpdateAppBehaviorUseCase.Execute`). `tokens` is refused in every edition;
 * `embedded_auth` and `geo_access` only in Pro, where their endpoints exist.
 */
export function genericUpdateRefused(code: string, isPro: boolean): boolean {
  return code === 'tokens' || code in COMMON_BEHAVIOR_SCREENS || (isPro && code in PRO_BEHAVIOR_SCREENS);
}
