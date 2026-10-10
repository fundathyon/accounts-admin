/**
 * Embedded Auth (Pro): the client-side model of the `embedded_auth` behavior.
 *
 * - Normalizes the backend response (`ToMap` omits empty strings and lists).
 * - Mirrors the backend contract (`internal/common/embeddedauth` → `Validate`)
 *   so the admin can flag every problem live, with the SAME field paths the
 *   backend uses in its 422 message (`allowed_origins[0]`, `branding.logo_url`…).
 * - Parses that 422 message (`"field: msg; field: msg"`) back into fields.
 *
 * The backend stays authoritative: this is a mirror for feedback, not a gate.
 * Only relative, type-only imports here — `mock-server/server.ts` imports this
 * module directly under Bun, where the `@/` alias does not resolve.
 */
import type {
  EmbeddedAuthAccent,
  EmbeddedAuthBehavior,
  EmbeddedAuthBranding,
  EmbeddedAuthConfig,
  EmbeddedAuthLayout,
  EmbeddedAuthLocale,
  EmbeddedAuthStrategies,
  EmbeddedAuthTheme,
} from './admin-types';

/** Contract limits (embeddedauth.MaxOrigins, MaxRedirectURLs, MaxNameLength…). */
export const EMBEDDED_AUTH_LIMITS = {
  maxOrigins: 20,
  maxRedirectUrls: 20,
  maxNameLength: 80,
  maxProviderLength: 32,
  maxUrlLength: 2048,
} as const;

/** OKLCH ranges of a custom accent (embeddedauth.Min/MaxAccent*). */
export const ACCENT_RANGE = {
  hue: { min: 0, max: 360 },
  l: { min: 0.3, max: 0.8 },
  c: { min: 0, max: 0.37 },
} as const;

/** The accent used when the app picks none (embeddedauth.DefaultAccent). */
export const DEFAULT_ACCENT = { hue: 45, l: 0.56, c: 0.17 } as const;

export const EMBEDDED_AUTH_THEMES: readonly EmbeddedAuthTheme[] = ['system', 'light', 'dark'];
export const EMBEDDED_AUTH_LAYOUTS: readonly EmbeddedAuthLayout[] = ['card', 'split'];
export const EMBEDDED_AUTH_LOCALES: readonly EmbeddedAuthLocale[] = ['es', 'en'];

/** Hosts that may use plain http (embeddedauth: localhost, 127.0.0.1 and [::1]). */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// ------------------------------------------------------------------ defaults

function emptyStrategies(): EmbeddedAuthStrategies {
  return { password: false, email_code: false, magic_link: false, oauth: [] };
}

/** What the backend shows to an app that never configured it (embeddedauth.Defaults). */
export function defaultEmbeddedAuthConfig(): EmbeddedAuthConfig {
  return {
    allowed_origins: [],
    redirect_urls: [],
    strategies: { password: true, email_code: false, magic_link: false, oauth: [] },
    branding: { name: '', logo_url: '', accent: { ...DEFAULT_ACCENT }, theme: 'system', layout: 'card', locale: 'es' },
    hide_branding: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * `"neutral"` or `{hue, l, c}`. A missing accent, or `{0, 0, 0}` (all three
 * omitted by ToMap), is the default accent — exactly how the backend reads it.
 */
export function normalizeAccent(value: unknown): EmbeddedAuthAccent {
  if (typeof value === 'string' && value.trim().toLowerCase() === 'neutral') return 'neutral';
  if (isRecord(value)) {
    const accent = { hue: num(value.hue), l: num(value.l), c: num(value.c) };
    if (accent.hue !== 0 || accent.l !== 0 || accent.c !== 0) return accent;
  }
  return { ...DEFAULT_ACCENT };
}

function normalizeStrategies(value: unknown): EmbeddedAuthStrategies {
  if (!isRecord(value)) return emptyStrategies();
  return {
    password: value.password === true,
    email_code: value.email_code === true,
    magic_link: value.magic_link === true,
    oauth: stringList(value.oauth),
  };
}

function normalizeBranding(value: unknown): EmbeddedAuthBranding {
  const b = isRecord(value) ? value : {};
  return {
    name: str(b.name),
    logo_url: str(b.logo_url),
    accent: normalizeAccent(b.accent),
    theme: oneOf(b.theme, EMBEDDED_AUTH_THEMES, 'system'),
    layout: oneOf(b.layout, EMBEDDED_AUTH_LAYOUTS, 'card'),
    locale: oneOf(b.locale, EMBEDDED_AUTH_LOCALES, 'es'),
  };
}

export function normalizeEmbeddedAuthConfig(value: unknown): EmbeddedAuthConfig {
  const c = isRecord(value) ? value : {};
  return {
    allowed_origins: stringList(c.allowed_origins),
    redirect_urls: stringList(c.redirect_urls),
    strategies: normalizeStrategies(c.strategies),
    branding: normalizeBranding(c.branding),
    hide_branding: c.hide_branding === true,
  };
}

/** Fills everything the backend's ToMap omitted (empty strings and lists). */
export function normalizeEmbeddedAuthBehavior(value: unknown): EmbeddedAuthBehavior {
  const raw = isRecord(value) ? value : {};
  const effective = isRecord(raw.effective) ? raw.effective : {};
  return {
    id: str(raw.id) || undefined,
    app_id: str(raw.app_id),
    config: isRecord(raw.config) ? normalizeEmbeddedAuthConfig(raw.config) : defaultEmbeddedAuthConfig(),
    effective: { enabled: effective.enabled === true, strategies: normalizeStrategies(effective.strategies) },
    available: normalizeStrategies(raw.available),
    created_at: str(raw.created_at) || undefined,
    updated_at: str(raw.updated_at) || undefined,
  };
}

/** Saved strategies the app can still offer (embeddedauth.Strategies.Intersect). */
export function intersectStrategies(s: EmbeddedAuthStrategies, av: EmbeddedAuthStrategies): EmbeddedAuthStrategies {
  const available = new Set(av.oauth.map(normalizeProvider));
  const seen = new Set<string>();
  const oauth: string[] = [];
  for (const raw of s.oauth) {
    const p = normalizeProvider(raw);
    if (validProvider(p) && available.has(p) && !seen.has(p)) {
      seen.add(p);
      oauth.push(p);
    }
  }
  return {
    password: s.password && av.password,
    email_code: s.email_code && av.email_code,
    magic_link: s.magic_link && av.magic_link,
    oauth,
  };
}

// ---------------------------------------------------------------- the issues

/** Stable ids of the contract violations (each one maps to an i18n key). */
export type EmbeddedAuthIssueCode =
  | 'empty'
  | 'too_long'
  | 'invalid_url'
  | 'scheme'
  | 'absolute'
  | 'userinfo'
  | 'host'
  | 'port'
  | 'wildcard'
  | 'path'
  | 'query'
  | 'fragment'
  | 'https'
  | 'origins_required'
  | 'origins_max'
  | 'origin_duplicate'
  | 'redirects_max'
  | 'redirect_duplicate'
  | 'redirect_origin'
  | 'strategy_required'
  | 'password_unavailable'
  | 'email_code_unavailable'
  | 'magic_link_unavailable'
  | 'magic_link_redirect'
  | 'provider_invalid'
  | 'provider_duplicate'
  | 'provider_unavailable'
  | 'name_too_long'
  | 'theme'
  | 'layout'
  | 'locale'
  | 'accent_invalid'
  | 'accent_hue'
  | 'accent_l'
  | 'accent_c';

export interface EmbeddedAuthIssue {
  /** Same path the backend uses: `allowed_origins[2]`, `strategies.oauth[0]`… */
  field: string;
  code: EmbeddedAuthIssueCode;
  params?: Record<string, string | number>;
}

/** The backend's English message for each issue (embeddedauth/urls.go + settings.go). */
export function issueMessageEn(issue: EmbeddedAuthIssue): string {
  const p = issue.params ?? {};
  switch (issue.code) {
    case 'empty': return 'must not be empty';
    case 'too_long': return `must be at most ${EMBEDDED_AUTH_LIMITS.maxUrlLength} characters`;
    case 'invalid_url': return 'must be a valid URL';
    case 'scheme': return 'must use http or https';
    case 'absolute': return 'must be an absolute URL with a host';
    case 'userinfo': return 'must not include user info';
    case 'host': return 'must have a valid host (international domains go in punycode)';
    case 'port': return 'must have a valid port';
    case 'wildcard': return 'must not contain wildcards';
    case 'path': return 'must not include a path: use scheme://host[:port]';
    case 'query': return 'must not include a query';
    case 'fragment': return 'must not include a fragment';
    case 'https': return 'must use https (http is only allowed for localhost, 127.0.0.1 and [::1])';
    case 'origins_required': return 'at least one origin is required';
    case 'origins_max': return `at most ${EMBEDDED_AUTH_LIMITS.maxOrigins} origins are allowed`;
    case 'origin_duplicate': return `duplicates allowed_origins[${p.index}] (${p.value})`;
    case 'redirects_max': return `at most ${EMBEDDED_AUTH_LIMITS.maxRedirectUrls} redirect URLs are allowed`;
    case 'redirect_duplicate': return `duplicates redirect_urls[${p.index}] (${p.value})`;
    case 'redirect_origin': return `its origin ${p.origin} must be one of allowed_origins`;
    case 'strategy_required': return 'at least one strategy must be enabled';
    case 'password_unavailable': return 'is not available: the app has no active email_auth behavior';
    case 'email_code_unavailable': return 'is not available: enable email_code in the email_auth behavior';
    case 'magic_link_unavailable': return 'is not available: enable magic_link in the email_auth behavior';
    case 'magic_link_redirect': return 'requires at least one entry in redirect_urls';
    case 'provider_invalid': return 'must be a lowercase provider name';
    case 'provider_duplicate': return `duplicates strategies.oauth[${p.index}]`;
    case 'provider_unavailable': return `provider "${p.provider}" is not configured and enabled for the app`;
    case 'name_too_long': return `must be at most ${EMBEDDED_AUTH_LIMITS.maxNameLength} characters`;
    case 'theme': return 'must be "system", "light" or "dark"';
    case 'layout': return 'must be "card" or "split"';
    case 'locale': return 'must be "es" or "en"';
    case 'accent_invalid': return 'must be "neutral" or an object with numeric hue, l and c';
    case 'accent_hue': return `must be between ${ACCENT_RANGE.hue.min} and ${ACCENT_RANGE.hue.max}`;
    case 'accent_l': return `must be between ${ACCENT_RANGE.l.min.toFixed(2)} and ${ACCENT_RANGE.l.max.toFixed(2)}`;
    case 'accent_c': return `must be between ${ACCENT_RANGE.c.min} and ${ACCENT_RANGE.c.max.toFixed(2)}`;
  }
}

/** `"field: msg; field: msg"` — the backend's 422 message format. */
export function joinIssues(issues: EmbeddedAuthIssue[]): string {
  return issues.map((i) => `${i.field}: ${issueMessageEn(i)}`).join('; ');
}

// ---------------------------------------------------------------------- URLs

interface ParsedUrl {
  scheme: 'http' | 'https';
  /** Lowercase; an IPv6 literal keeps its brackets. */
  host: string;
  /** '' when it is the scheme's default port. */
  port: string;
  /** Path as typed ('' when there is none). */
  path: string;
  /** Query without '?' ('' when absent). */
  query: string;
  /** True when a '?' is present, even with an empty query (Go's ForceQuery). */
  hasQuery: boolean;
  hasFragment: boolean;
}

function originOf(u: ParsedUrl): string {
  return `${u.scheme}://${u.host}${u.port ? `:${u.port}` : ''}`;
}

function isLocal(u: ParsedUrl): boolean {
  return LOCAL_HOSTS.has(u.host);
}

function isSecure(u: ParsedUrl): boolean {
  return u.scheme === 'https' || isLocal(u);
}

/** ASCII punctuation Go's url.Parse accepts in a host (url.shouldEscape, encodeHost). */
const HOST_PUNCTUATION = new Set("-_.~!$&'()*+,;=:[]<>\"".split(''));

/**
 * Host check in two steps, like the backend: characters url.Parse itself
 * rejects make an invalid URL; a parsable host that is not an IP or an ASCII
 * name is an invalid host.
 */
function hostProblem(host: string): EmbeddedAuthIssueCode | null {
  if (host.startsWith('[') && host.endsWith(']')) {
    // IPv6 literal: let the platform parser decide.
    try {
      return new URL(`http://${host}/`).hostname === host ? null : 'invalid_url';
    } catch {
      return 'invalid_url';
    }
  }
  for (const ch of host) {
    if (ch.charCodeAt(0) < 0x80 && !/[a-z0-9]/.test(ch) && !HOST_PUNCTUATION.has(ch)) return 'invalid_url';
  }
  // IPv4 or an ASCII name. A browser sends international domains in punycode,
  // so anything else would never match a real Origin header.
  return /^[a-z0-9._-]+$/.test(host) ? null : 'host';
}

/**
 * The checks common to origins, redirects and logos (embeddedauth.parseHTTP):
 * an absolute http(s) URL with a valid host and port and no userinfo.
 */
function parseHttp(raw: string): { url: ParsedUrl } | { code: EmbeddedAuthIssueCode } {
  const s = raw.trim();
  if (s === '') return { code: 'empty' };
  if (s.length > EMBEDDED_AUTH_LIMITS.maxUrlLength) return { code: 'too_long' };
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(s);
  if (!schemeMatch) return { code: 'scheme' };
  const scheme = schemeMatch[1].toLowerCase();
  if (scheme !== 'http' && scheme !== 'https') return { code: 'scheme' };
  let rest = s.slice(schemeMatch[0].length);
  if (!rest.startsWith('//')) return { code: 'absolute' };
  rest = rest.slice(2);

  const hashAt = rest.indexOf('#');
  const hasFragment = hashAt !== -1;
  if (hasFragment) rest = rest.slice(0, hashAt);
  const queryAt = rest.indexOf('?');
  const hasQuery = queryAt !== -1;
  const query = hasQuery ? rest.slice(queryAt + 1) : '';
  if (hasQuery) rest = rest.slice(0, queryAt);
  const slashAt = rest.indexOf('/');
  const authority = slashAt === -1 ? rest : rest.slice(0, slashAt);
  const path = slashAt === -1 ? '' : rest.slice(slashAt);

  if (authority === '') return { code: 'absolute' };
  if (authority.includes('@')) return { code: 'userinfo' };

  let host: string;
  let port = '';
  if (authority.startsWith('[')) {
    const close = authority.indexOf(']');
    if (close === -1) return { code: 'invalid_url' };
    host = authority.slice(0, close + 1);
    const after = authority.slice(close + 1);
    if (after !== '') {
      if (!after.startsWith(':')) return { code: 'invalid_url' };
      port = after.slice(1);
    }
  } else {
    const colon = authority.lastIndexOf(':');
    host = colon === -1 ? authority : authority.slice(0, colon);
    port = colon === -1 ? '' : authority.slice(colon + 1);
  }
  if (port !== '' && !/^[0-9]+$/.test(port)) return { code: 'invalid_url' };
  host = host.toLowerCase();
  const badHost = host === '' ? 'host' : hostProblem(host);
  if (badHost) return { code: badHost };
  if (port !== '') {
    const n = Number(port);
    if (!Number.isInteger(n) || n < 1 || n > 65535) return { code: 'port' };
    port = String(n);
    if ((scheme === 'https' && n === 443) || (scheme === 'http' && n === 80)) port = '';
  }
  return { url: { scheme, host, port, path, query, hasQuery, hasFragment } };
}

/**
 * An allowed origin: `scheme://host[:port]`, https unless local. Returns the
 * canonical origin (lowercase, default port dropped) or the problem.
 */
export function checkOrigin(raw: string): { origin: string } | { code: EmbeddedAuthIssueCode } {
  if (raw.includes('*')) return { code: 'wildcard' };
  const parsed = parseHttp(raw);
  if ('code' in parsed) return parsed;
  const u = parsed.url;
  if (u.path !== '' && u.path !== '/') return { code: 'path' };
  if (u.hasQuery) return { code: 'query' };
  if (u.hasFragment) return { code: 'fragment' };
  if (!isSecure(u)) return { code: 'https' };
  return { origin: originOf(u) };
}

/**
 * A magic-link redirect: absolute http(s), no fragment, https unless local.
 * Returns its canonical form and its origin, or the problem.
 */
export function checkRedirect(raw: string): { redirect: string; origin: string } | { code: EmbeddedAuthIssueCode } {
  const parsed = parseHttp(raw);
  if ('code' in parsed) return parsed;
  const u = parsed.url;
  if (u.hasFragment) return { code: 'fragment' };
  if (!isSecure(u)) return { code: 'https' };
  const origin = originOf(u);
  return { redirect: `${origin}${u.path || '/'}${u.query ? `?${u.query}` : ''}`, origin };
}

/** The logo: empty, or an https URL (http only for local hosts). */
export function checkLogoUrl(raw: string): EmbeddedAuthIssueCode | null {
  if (raw.trim() === '') return null;
  const parsed = parseHttp(raw);
  if ('code' in parsed) return parsed.code;
  return isSecure(parsed.url) ? null : 'https';
}

export function normalizeProvider(p: string): string {
  return p.trim().toLowerCase();
}

function validProvider(p: string): boolean {
  return p.length > 0 && p.length <= EMBEDDED_AUTH_LIMITS.maxProviderLength && /^[a-z0-9_-]+$/.test(p);
}

// ------------------------------------------------------------------ validate

/**
 * Mirror of embeddedauth.Settings.Validate: strict, same order and same field
 * paths, so a client issue and a server 422 land on the same control.
 */
export function validateEmbeddedAuthConfig(c: EmbeddedAuthConfig, av: EmbeddedAuthStrategies): EmbeddedAuthIssue[] {
  const issues: EmbeddedAuthIssue[] = [];
  const add = (field: string, code: EmbeddedAuthIssueCode, params?: EmbeddedAuthIssue['params']) =>
    issues.push(params ? { field, code, params } : { field, code });

  // allowed_origins: 1..20, each scheme://host[:port], no duplicates.
  if (c.allowed_origins.length === 0) add('allowed_origins', 'origins_required');
  else if (c.allowed_origins.length > EMBEDDED_AUTH_LIMITS.maxOrigins) add('allowed_origins', 'origins_max');
  const origins = new Map<string, number>();
  c.allowed_origins.forEach((raw, i) => {
    const field = `allowed_origins[${i}]`;
    const res = checkOrigin(raw);
    if ('code' in res) return add(field, res.code);
    const dup = origins.get(res.origin);
    if (dup !== undefined) return add(field, 'origin_duplicate', { index: dup, value: res.origin });
    origins.set(res.origin, i);
  });

  // redirect_urls: 0..20, absolute, no duplicates, from an allowed origin.
  if (c.redirect_urls.length > EMBEDDED_AUTH_LIMITS.maxRedirectUrls) add('redirect_urls', 'redirects_max');
  const redirects = new Map<string, number>();
  c.redirect_urls.forEach((raw, i) => {
    const field = `redirect_urls[${i}]`;
    const res = checkRedirect(raw);
    if ('code' in res) return add(field, res.code);
    const dup = redirects.get(res.redirect);
    if (dup !== undefined) return add(field, 'redirect_duplicate', { index: dup, value: res.redirect });
    redirects.set(res.redirect, i);
    if (!origins.has(res.origin)) add(field, 'redirect_origin', { origin: res.origin });
  });

  // strategies: at least one, and only what the app has available.
  const st = c.strategies;
  if (!st.password && !st.email_code && !st.magic_link && st.oauth.length === 0) add('strategies', 'strategy_required');
  if (st.password && !av.password) add('strategies.password', 'password_unavailable');
  if (st.email_code && !av.email_code) add('strategies.email_code', 'email_code_unavailable');
  if (st.magic_link && !av.magic_link) add('strategies.magic_link', 'magic_link_unavailable');
  if (st.magic_link && c.redirect_urls.length === 0) add('strategies.magic_link', 'magic_link_redirect');
  const available = new Set(av.oauth.map(normalizeProvider));
  const providers = new Map<string, number>();
  st.oauth.forEach((p, i) => {
    const field = `strategies.oauth[${i}]`;
    if (!validProvider(p)) return add(field, 'provider_invalid');
    const dup = providers.get(p);
    if (dup !== undefined) return add(field, 'provider_duplicate', { index: dup });
    providers.set(p, i);
    if (!available.has(p)) add(field, 'provider_unavailable', { provider: p });
  });

  // branding.
  const b = c.branding;
  if ([...b.name.trim()].length > EMBEDDED_AUTH_LIMITS.maxNameLength) add('branding.name', 'name_too_long');
  const logo = checkLogoUrl(b.logo_url);
  if (logo) add('branding.logo_url', logo);
  if (!(EMBEDDED_AUTH_THEMES as readonly string[]).includes(b.theme)) add('branding.theme', 'theme');
  if (!(EMBEDDED_AUTH_LAYOUTS as readonly string[]).includes(b.layout)) add('branding.layout', 'layout');
  if (!(EMBEDDED_AUTH_LOCALES as readonly string[]).includes(b.locale)) add('branding.locale', 'locale');
  const a = b.accent;
  if (a !== 'neutral') {
    if (!isRecord(a) || ![a.hue, a.l, a.c].every((n) => typeof n === 'number' && !Number.isNaN(n))) {
      add('branding.accent', 'accent_invalid');
    } else if (a.hue !== 0 || a.l !== 0 || a.c !== 0) {
      if (!(a.hue >= ACCENT_RANGE.hue.min && a.hue <= ACCENT_RANGE.hue.max)) add('branding.accent.hue', 'accent_hue');
      if (!(a.l >= ACCENT_RANGE.l.min && a.l <= ACCENT_RANGE.l.max)) add('branding.accent.l', 'accent_l');
      if (!(a.c >= ACCENT_RANGE.c.min && a.c <= ACCENT_RANGE.c.max)) add('branding.accent.c', 'accent_c');
    }
  }
  return issues;
}

// ------------------------------------------------------------ server errors

export interface ServerFieldError {
  field: string;
  message: string;
  /** Set when the backend message is one of the known ones, so it can be localized. */
  code?: EmbeddedAuthIssueCode;
}

/** A backend field path: one of the config's roots, then `[i]` / `.key` steps. */
const FIELD_PATH = String.raw`(?:allowed_origins|redirect_urls|strategies|branding|hide_branding)(?:\[\d+\])?(?:\.[a-z_]+(?:\[\d+\])?)*`;

/** Parameter-free messages, so a backend message can be mapped back to its code. */
const STATIC_CODES: EmbeddedAuthIssueCode[] = [
  'empty', 'too_long', 'invalid_url', 'scheme', 'absolute', 'userinfo', 'host', 'port', 'wildcard', 'path',
  'query', 'fragment', 'https', 'origins_required', 'origins_max', 'redirects_max', 'strategy_required',
  'password_unavailable', 'email_code_unavailable', 'magic_link_unavailable', 'magic_link_redirect',
  'provider_invalid', 'name_too_long', 'theme', 'layout', 'locale', 'accent_invalid', 'accent_hue', 'accent_l',
  'accent_c',
];

/**
 * Splits `app_behaviors.embedded_auth.invalid_config`'s message
 * (`"allowed_origins[0]: must use https …; strategies: …"`) into fields. Only
 * splits on `"; "` followed by a field path, so a `;` inside a value is safe.
 */
export function parseServerFieldErrors(message: string): ServerFieldError[] {
  if (!message) return [];
  const parts = message.split(new RegExp(`;\\s+(?=${FIELD_PATH}: )`));
  const out: ServerFieldError[] = [];
  for (const part of parts) {
    const m = new RegExp(`^(${FIELD_PATH}): ([\\s\\S]*)$`).exec(part.trim());
    if (!m) continue;
    const [, field, text] = m;
    const code = STATIC_CODES.find((c) => issueMessageEn({ field, code: c }) === text);
    out.push(code ? { field, message: text, code } : { field, message: text });
  }
  return out;
}

// ------------------------------------------------------------------ helpers

/** CSS color of an accent, for swatches and the static preview. */
export function accentCss(accent: EmbeddedAuthAccent, scheme: 'light' | 'dark'): string {
  if (accent === 'neutral') return scheme === 'dark' ? 'oklch(0.96 0 0)' : 'oklch(0.21 0 0)';
  return `oklch(${accent.l} ${accent.c} ${accent.hue})`;
}

/** Text color on top of an accent fill (light accents get dark text). */
export function accentOnCss(accent: EmbeddedAuthAccent, scheme: 'light' | 'dark'): string {
  if (accent === 'neutral') return scheme === 'dark' ? 'oklch(0.21 0 0)' : 'oklch(0.99 0 0)';
  return accent.l > 0.7 ? 'oklch(0.21 0 0)' : 'oklch(0.99 0 0)';
}

export function sameAccent(a: EmbeddedAuthAccent, b: EmbeddedAuthAccent): boolean {
  if (a === 'neutral' || b === 'neutral') return a === b;
  return a.hue === b.hue && a.l === b.l && a.c === b.c;
}
