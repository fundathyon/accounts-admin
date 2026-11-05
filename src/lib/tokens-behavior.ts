/**
 * The Pro `tokens` behavior (`internal/common/tokenpolicy`): token lifetimes,
 * sessions, concurrent sessions and revocation when credentials change.
 * Imported by the mock server by relative path: no `@/` imports here.
 */

export type RevokeScope = 'all' | 'others' | 'none';
export type OnLimit = 'revoke_oldest' | 'reject';

export interface TokenLifetimes {
  access_token_seconds: number;
  refresh_token_seconds: number;
  activation_token_seconds: number;
  password_reset_token_seconds: number;
}

export interface TokensConfig {
  lifetimes: TokenLifetimes;
  sessions: {
    refresh_rotation: boolean;
    reuse_interval_seconds: number;
    /** 0 = no idle limit. */
    idle_timeout_seconds: number;
  };
  limits: {
    /** 0 = no limit. */
    max_sessions_per_user: number;
    on_limit: OnLimit;
  };
  revocation: {
    on_password_change: RevokeScope;
    on_password_reset: Exclude<RevokeScope, 'others'>;
    on_email_change: RevokeScope;
  };
}

export type TokensSection = keyof TokensConfig;

/** GET/PUT response: the stored config (0 lifetimes = inherited) and the one in force. */
export interface TokensBehavior {
  id?: string;
  app_id: string;
  config: TokensConfig;
  effective: TokensConfig;
  created_at?: string;
  updated_at?: string;
}

const MIN = 60;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const TOKENS_DEFAULTS: TokensConfig = {
  lifetimes: {
    access_token_seconds: 15 * MIN,
    refresh_token_seconds: 30 * DAY,
    activation_token_seconds: 15 * MIN,
    password_reset_token_seconds: 15 * MIN,
  },
  sessions: { refresh_rotation: false, reuse_interval_seconds: 30, idle_timeout_seconds: 0 },
  limits: { max_sessions_per_user: 0, on_limit: 'revoke_oldest' },
  // Like the backend: unconfigured, changing credentials closes no session.
  revocation: { on_password_change: 'none', on_password_reset: 'none', on_email_change: 'none' },
};

export const TOKENS_TEMPLATES: Record<string, TokensConfig> = {
  default: TOKENS_DEFAULTS,
  web: {
    ...TOKENS_DEFAULTS,
    sessions: { refresh_rotation: true, reuse_interval_seconds: 30, idle_timeout_seconds: 14 * DAY },
    limits: { max_sessions_per_user: 5, on_limit: 'revoke_oldest' },
  },
  mobile: {
    ...TOKENS_DEFAULTS,
    lifetimes: { ...TOKENS_DEFAULTS.lifetimes, access_token_seconds: 30 * MIN, refresh_token_seconds: 365 * DAY },
    sessions: { refresh_rotation: true, reuse_interval_seconds: 60, idle_timeout_seconds: 90 * DAY },
    limits: { max_sessions_per_user: 10, on_limit: 'revoke_oldest' },
  },
  strict: {
    lifetimes: {
      access_token_seconds: 5 * MIN,
      refresh_token_seconds: 8 * HOUR,
      activation_token_seconds: 10 * MIN,
      password_reset_token_seconds: 10 * MIN,
    },
    sessions: { refresh_rotation: true, reuse_interval_seconds: 0, idle_timeout_seconds: 1 * HOUR },
    limits: { max_sessions_per_user: 1, on_limit: 'reject' },
    revocation: { on_password_change: 'all', on_password_reset: 'all', on_email_change: 'all' },
  },
};

/** `tokenpolicy` limits, in seconds. */
export const TOKENS_LIMITS = {
  access: { min: 5 * MIN, max: DAY },
  refresh: { min: HOUR, max: 365 * DAY },
  activation: { min: 5 * MIN, max: DAY },
  reset: { min: 5 * MIN, max: 2 * HOUR },
  reuseMax: 300,
  idle: { min: HOUR, max: 365 * DAY },
  maxSessions: 100,
};

export type DurationUnit = 'min' | 'h' | 'd';

export const UNIT_SECONDS: Record<DurationUnit, number> = { min: MIN, h: HOUR, d: DAY };

export function bestUnit(seconds: number): DurationUnit {
  if (seconds > 0 && seconds % DAY === 0) return 'd';
  if (seconds > 0 && seconds % HOUR === 0) return 'h';
  return 'min';
}

type Translate = (key: string, params?: Record<string, string | number>) => string;

export function humanizeDuration(t: Translate, seconds: number): string {
  if (seconds <= 0) return '—';
  const unit = bestUnit(seconds);
  const amount = seconds / UNIT_SECONDS[unit];
  const value = Number.isInteger(amount) ? amount : Number(amount.toFixed(1));
  return t(`behaviors.tokens.duration.${unit}${value === 1 ? 'One' : 'Many'}`, { value });
}

export type TokensField = 'access' | 'refresh' | 'activation' | 'reset' | 'reuse' | 'idle' | 'maxSessions';
export type TokensErrors = Partial<Record<TokensField, string>>;

export const TOKENS_FIELD_SECTION: Record<TokensField, TokensSection> = {
  access: 'lifetimes',
  refresh: 'lifetimes',
  activation: 'lifetimes',
  reset: 'lifetimes',
  reuse: 'sessions',
  idle: 'sessions',
  maxSessions: 'limits',
};

/** `Settings.Validate` over a draft: every lifetime is set, there is nothing to inherit here. */
export function validateTokens(t: Translate, c: TokensConfig): TokensErrors {
  const errors: TokensErrors = {};
  const range = (seconds: number, { min, max }: { min: number; max: number }) =>
    seconds < min || seconds > max
      ? t('behaviors.tokens.errors.between', { min: humanizeDuration(t, min), max: humanizeDuration(t, max) })
      : undefined;
  const { lifetimes, sessions, limits } = c;

  errors.access = range(lifetimes.access_token_seconds, TOKENS_LIMITS.access);
  errors.refresh = range(lifetimes.refresh_token_seconds, TOKENS_LIMITS.refresh);
  if (!errors.refresh && lifetimes.refresh_token_seconds <= lifetimes.access_token_seconds) {
    errors.refresh = t('behaviors.tokens.errors.longerThanAccess');
  }
  errors.activation = range(lifetimes.activation_token_seconds, TOKENS_LIMITS.activation);
  errors.reset = range(lifetimes.password_reset_token_seconds, TOKENS_LIMITS.reset);

  if (sessions.reuse_interval_seconds < 0 || sessions.reuse_interval_seconds > TOKENS_LIMITS.reuseMax) {
    errors.reuse = t('behaviors.tokens.errors.reuse', { max: TOKENS_LIMITS.reuseMax });
  }
  const idle = sessions.idle_timeout_seconds;
  if (idle > 0) {
    const minIdle = Math.max(TOKENS_LIMITS.idle.min, 2 * lifetimes.access_token_seconds);
    if (idle < minIdle) errors.idle = t('behaviors.tokens.errors.idleMin', { min: humanizeDuration(t, minIdle) });
    else if (idle > TOKENS_LIMITS.idle.max) {
      errors.idle = t('behaviors.tokens.errors.idleMax', { max: humanizeDuration(t, TOKENS_LIMITS.idle.max) });
    } else if (idle >= lifetimes.refresh_token_seconds) errors.idle = t('behaviors.tokens.errors.idleNoEffect');
  }
  const max = limits.max_sessions_per_user;
  if (max < 0 || max > TOKENS_LIMITS.maxSessions || !Number.isInteger(max)) {
    errors.maxSessions = t('behaviors.tokens.errors.maxSessions', { max: TOKENS_LIMITS.maxSessions });
  }
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v));
}

/**
 * Body of the PUT. A lifetime the app inherits (0 in the stored config) that
 * was not touched goes as 0, so it keeps inheriting instead of being pinned to
 * today's value.
 */
export function tokensRequest(draft: TokensConfig, behavior: TokensBehavior): TokensConfig {
  const lifetimes = { ...draft.lifetimes };
  for (const key of Object.keys(lifetimes) as (keyof TokenLifetimes)[]) {
    if (behavior.config.lifetimes[key] === 0 && lifetimes[key] === behavior.effective.lifetimes[key]) {
      lifetimes[key] = 0;
    }
  }
  return { ...draft, lifetimes };
}
