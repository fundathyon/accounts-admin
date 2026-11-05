import type { ApiError, Envelope } from './api-envelope';
import type { Translate } from './i18n/types';

/**
 * Email templates of Accounts: a theme plus branding for every email, and
 * optional custom HTML per email. Shapes of `/api/email-templates/*`, with
 * Accounts' envelope.
 *
 * Accounts has two route families and each edition can write to only one
 * (`upsert.go`, `delete.go` and `themes.go` in the use cases):
 * - Pro edits per-app rows with the app's secret key (`/api/v1/email-templates`).
 *   The operator routes answer 403 to its writes.
 * - Community edits the global row with the admin key (`/v1/email-templates`).
 *   The app routes answer 403 to its writes, and their reads ignore the global
 *   overrides, so a Community screen never uses them.
 *
 * The admin key stays in the BFF: the browser only asks for the global scope.
 */

/** Asks the BFF for the operator routes; the admin key is added server side. */
export const EMAIL_SCOPE_HEADER = 'X-Email-Templates-Scope';
export const EMAIL_SCOPE_GLOBAL = 'global';

/** Headers of a request: the app's secret key, or `null` for the global scope. */
export function emailScopeHeaders(secretKey: string | null): Record<string, string> {
  return secretKey ? { 'X-Secret-API-Key': secretKey } : { [EMAIL_SCOPE_HEADER]: EMAIL_SCOPE_GLOBAL };
}

/** The themes and the catalog are in English, so the screen edits that locale. */
export const EMAIL_LOCALE = 'en';
export const MAX_HTML_BYTES = 200 * 1024;
export const DEFAULT_PREVIEW_TEMPLATE = 'signup_activation_code';

export type Corners = 'sharp' | 'soft' | 'round';
export type Font = 'sans' | 'serif' | 'mono';

export type ThemeTokens = {
  canvas: string;
  surface: string;
  border: string;
  heading: string;
  text: string;
  muted: string;
  accent: string;
  font: Font;
  heading_font: Font;
  corners: Corners;
  align: 'left' | 'center';
  top_bar?: boolean;
  dark?: boolean;
};

export type EmailTheme = {
  id: string;
  name: string;
  description: string;
  bg_color: string;
  accent_color: string;
  text_color: string;
  is_dark: boolean;
  tokens: ThemeTokens;
  preview_html: string;
  preview_template_id: string;
};

/** Everything optional: an empty field keeps what the theme ships. */
export type EmailBranding = {
  logo_url?: string;
  display_name?: string;
  accent_color?: string;
  corners?: Corners;
  font?: Font;
  footer_text?: string;
  support_email?: string;
};

export type EmailThemesData = {
  default_theme_id: string;
  active_theme_id: string;
  scope: 'app' | 'global' | 'default';
  branding?: EmailBranding;
  themes: EmailTheme[];
};

export type CatalogItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  subject_default: string;
  from_name_default: string;
  required_variables: string[];
  optional_variables: string[];
  safe_html_variables?: string[];
  baseline_ref: string;
  has_override: boolean;
  override_enabled: boolean;
  override_locales?: string[];
};

export type EmailCatalog = {
  version: string;
  channel: string;
  items: CatalogItem[];
  allowed_globals: string[];
  forbidden_variables: string[];
};

export type TemplateView = {
  source: 'override' | 'baseline';
  baseline_ref: string;
  template_id: string;
  locale: string;
  enabled: boolean;
  subject: string;
  from_name: string;
  html: string;
  text?: string;
};

export type EmailPreview = {
  subject: string;
  from_name: string;
  html: string;
  /** `per_app_db`, `global_db` or `theme:<id>`. */
  source: string;
  warnings?: string[];
};

export type ProviderStatus =
  | { state: 'loading' }
  /** Nothing to ask with: `/email-config` needs a secret key, in both editions. */
  | { state: 'unknown' }
  | { state: 'ok'; client: string; sender: string }
  | { state: 'missing' }
  | { state: 'error' };

/** What the editor edits and saves: one theme plus the branding over it. */
export type EmailLook = { themeId: string; branding: EmailBranding };

/** Same call, whichever panel makes it: adds the scope to a BFF request. */
export type EmailRequest = (path: string, init?: RequestInit) => Promise<Response>;

/** `catalog.has_override` covers any locale; the screen only edits `EMAIL_LOCALE`. */
export function hasOverride(item: CatalogItem): boolean {
  return item.has_override && (item.override_locales ?? []).includes(EMAIL_LOCALE);
}

/**
 * Which override rendered a preview: the scope's own, or (Pro only) a global one
 * the app inherits and cannot edit. `null` when the theme rendered it, which
 * includes an override stored as disabled.
 */
export function previewOverride(source: string | undefined, secretKey: string | null): 'own' | 'inherited' | null {
  if (source === 'per_app_db') return 'own';
  if (source === 'global_db') return secretKey ? 'inherited' : 'own';
  return null;
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Expands #abc to #aabbcc; anything else comes back as is. */
export function normalizeHex(value: string): string {
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return v;
}

/** Black or white, whichever reads on top of a `#rrggbb` swatch. */
export function readableOn(hex: string): '#000000' | '#ffffff' {
  const v = normalizeHex(hex);
  const channel = (start: number) => parseInt(v.slice(start, start + 2), 16);
  const brightness = (channel(1) * 299 + channel(3) * 587 + channel(5) * 114) / 1000;
  return brightness >= 150 ? '#000000' : '#ffffff';
}

/** Drops empty strings so drafts compare and serialize like the server stores them. */
export function compactBranding(b: EmailBranding): EmailBranding {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(b) as [keyof EmailBranding, string | undefined][]) {
    const trimmed = typeof value === 'string' ? value.trim() : value;
    if (trimmed) out[key] = trimmed;
  }
  if (out.accent_color) out.accent_color = normalizeHex(out.accent_color);
  return out as EmailBranding;
}

export function sameLook(a: EmailLook, b: EmailLook): boolean {
  if (a.themeId !== b.themeId) return false;
  const x = compactBranding(a.branding);
  const y = compactBranding(b.branding);
  const keys = new Set([...Object.keys(x), ...Object.keys(y)]) as Set<keyof EmailBranding>;
  for (const key of keys) if (x[key] !== y[key]) return false;
  return true;
}

export type BrandingErrorKey =
  | 'logoUrl'
  | 'displayNameLength'
  | 'accentHex'
  | 'footerLength'
  | 'footerLines'
  | 'supportEmail';

const LOOPBACK = ['localhost', '127.0.0.1', '[::1]'];

/**
 * Mirror of `Branding.Validate` (templates/catalog/branding.go), so typing never
 * floods the preview with 422s. The server stays the authority on save.
 * Values are keys under `emailTemplates.branding.errors`.
 */
export function brandingErrors(b: EmailBranding): Partial<Record<keyof EmailBranding, BrandingErrorKey>> {
  const errors: Partial<Record<keyof EmailBranding, BrandingErrorKey>> = {};
  const logo = b.logo_url?.trim();
  if (logo) {
    let url: URL | null = null;
    try {
      url = new URL(logo);
    } catch {
      url = null;
    }
    const local = url?.protocol === 'http:' && LOOPBACK.includes(url.hostname);
    const allowed = url && (url.protocol === 'https:' || local) && !url.username && !url.password;
    if (!allowed || logo.length > 2048 || /[\s"'<>]/.test(logo)) errors.logo_url = 'logoUrl';
  }
  if ([...(b.display_name?.trim() ?? '')].length > 80) errors.display_name = 'displayNameLength';
  const accent = b.accent_color?.trim();
  if (accent && !HEX.test(accent)) errors.accent_color = 'accentHex';
  const footer = b.footer_text?.trim() ?? '';
  if ([...footer].length > 300) errors.footer_text = 'footerLength';
  else if (footer.split('\n').length > 6) errors.footer_text = 'footerLines';
  const email = b.support_email?.trim();
  if (email && (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))) {
    errors.support_email = 'supportEmail';
  }
  return errors;
}

/** Scopes of the use cases that have copy of their own. */
const ERROR_KEYS: Record<string, string> = {
  'email_templates.pro_required': 'emailTemplates.errors.editionRejected',
  'email_templates.themes.pro_required': 'emailTemplates.errors.editionRejected',
  'email_templates.unknown_template': 'emailTemplates.errors.unknownTemplate',
  'email_templates.preview.unknown_template': 'emailTemplates.errors.unknownTemplate',
  'email_templates.themes.unknown_theme': 'emailTemplates.errors.unknownTheme',
  'email_templates.html_required': 'emailTemplates.errors.htmlRequired',
  'email_templates.html_too_large': 'emailTemplates.errors.htmlTooLarge',
  'email_templates.sanitization_failed': 'emailTemplates.errors.sanitization',
  'email_templates.test_email_required': 'emailTemplates.errors.testEmailRequired',
  'email_templates.test.no_email_config': 'emailTemplates.errors.noEmailConfig',
  'email_templates.test.send_failed': 'emailTemplates.errors.sendFailed',
  'email_templates.test.rate_limited': 'emailTemplates.errors.rateLimited',
  'quota.feature_not_in_plan': 'emailTemplates.errors.notInPlan',
};

function stringList(value: unknown): string {
  return Array.isArray(value) ? value.filter((v) => typeof v === 'string').join(', ') : '';
}

/** The copy of a known error, or what Accounts said, or the fallback. */
export function emailTemplatesErrorMessage(t: Translate, err: ApiError | undefined, fallback: string): string {
  const meta = (err?.meta ?? {}) as Record<string, unknown>;
  if (err?.scope === 'email_templates.missing_required_variables') {
    return t('emailTemplates.errors.missingVariables', { variables: stringList(meta.missing) });
  }
  if (err?.scope === 'email_templates.forbidden_variables') {
    return t('emailTemplates.errors.forbiddenVariables', { variables: stringList(meta.forbidden) });
  }
  if (err?.scope === 'email_templates.themes.invalid_branding' && err.message) {
    return t('emailTemplates.errors.invalidBranding', { details: err.message });
  }
  const key = err?.scope ? ERROR_KEYS[err.scope] : undefined;
  return key ? t(key) : err?.message || fallback;
}

/** The JSON of a BFF response; `null` when it has no body (a 204, a 404 of an older API). */
export async function readEnvelope(res: Response): Promise<Envelope | null> {
  return (await res.json().catch(() => null)) as Envelope | null;
}
