'use client';

import type { CSSProperties, ReactNode } from 'react';
import { OAuthProviderLogo } from '@/components/oauth-provider-logo';
import { getMessages } from '@/lib/i18n';
import { accentCss, accentOnCss, checkLogoUrl } from '@/lib/embedded-auth';
import type { EmbeddedAuthBranding, EmbeddedAuthStrategies } from '@/lib/admin-types';

interface MockPreviewProps {
  branding: EmbeddedAuthBranding;
  hideBranding: boolean;
  /** What the component would actually offer (saved ∩ available). */
  strategies: EmbeddedAuthStrategies;
  scheme: 'light' | 'dark';
}

/** Colors of the DS v2 tokens the component ships (`--fdn-*`), per scheme. */
const PALETTE = {
  light: {
    canvas: 'oklch(0.975 0.002 260)',
    surface: 'oklch(1 0 0)',
    border: 'oklch(0.9 0.004 260)',
    borderStrong: 'oklch(0.84 0.006 260)',
    text: 'oklch(0.21 0.006 260)',
    muted: 'oklch(0.52 0.01 260)',
  },
  dark: {
    canvas: 'oklch(0.16 0.004 260)',
    surface: 'oklch(0.205 0.005 260)',
    border: 'oklch(0.29 0.006 260)',
    borderStrong: 'oklch(0.36 0.008 260)',
    text: 'oklch(0.96 0.003 260)',
    muted: 'oklch(0.7 0.01 260)',
  },
} as const;

function providerName(provider: string): string {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

/**
 * Static stand-in for `<accounts-sign-in>` when the real bundle cannot be
 * loaded (Community backend, mock server, unreachable URL). It follows the
 * component's first screen — 320px card, one primary CTA, alternatives and
 * OAuth as secondary buttons under the divider — in the component's own
 * language (`branding.locale`), not the admin's.
 */
export function EmbeddedAuthMockPreview({ branding, hideBranding, strategies, scheme }: MockPreviewProps) {
  const messages = getMessages(branding.locale);
  const m = (key: string, params?: Record<string, string>) => {
    const mock = (messages.embeddedAuth as { mock?: Record<string, string> } | undefined)?.mock ?? {};
    let value = mock[key] ?? key;
    for (const [k, v] of Object.entries(params ?? {})) value = value.replace(`{${k}}`, v);
    return value;
  };
  const c = PALETTE[scheme];
  const accent = accentCss(branding.accent, scheme);
  const onAccent = accentOnCss(branding.accent, scheme);
  const name = branding.name.trim();
  const logo = branding.logo_url.trim() && checkLogoUrl(branding.logo_url) === null ? branding.logo_url.trim() : '';
  const passwordless = !strategies.password && (strategies.email_code || strategies.magic_link);
  const nothing = !strategies.password && !strategies.email_code && !strategies.magic_link && strategies.oauth.length === 0;

  const title = passwordless
    ? name ? m('passwordlessTitle', { app: name }) : m('titleGeneric')
    : name ? m('title', { app: name }) : m('titleGeneric');
  const subtitle = passwordless ? (strategies.email_code ? m('passwordlessSubtitle') : '') : name ? m('subtitle', { app: name }) : '';

  const field: CSSProperties = {
    height: 32,
    borderRadius: 6,
    border: `1px solid ${c.borderStrong}`,
    background: c.surface,
    padding: '0 10px',
    display: 'flex',
    alignItems: 'center',
    fontSize: 13,
    color: c.muted,
  };
  const primary: CSSProperties = {
    height: 32,
    borderRadius: 6,
    background: accent,
    color: onAccent,
    fontSize: 12,
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
  const secondary: CSSProperties = {
    ...primary,
    background: c.surface,
    color: c.text,
    border: `1px solid ${c.borderStrong}`,
    gap: 8,
  };
  const label: CSSProperties = { fontSize: 12, fontWeight: 500, color: c.text, marginBottom: 6 };

  const alternatives: ReactNode[] = [];
  if (strategies.password && strategies.email_code) alternatives.push(<div key="code" style={secondary}>{m('useCode')}</div>);
  if ((strategies.password || strategies.email_code) && strategies.magic_link) {
    alternatives.push(<div key="magic" style={secondary}>{m('sendMagicLink')}</div>);
  }
  for (const provider of strategies.oauth) {
    alternatives.push(
      <div key={provider} style={secondary}>
        <OAuthProviderLogo provider={provider} size={14} />
        {m('continueWith', { provider: providerName(provider) })}
      </div>
    );
  }
  const hasPrimaryForm = strategies.password || strategies.email_code || strategies.magic_link;

  const card = (
    <div
      style={{
        width: 320,
        maxWidth: '100%',
        background: c.surface,
        border: `1px solid ${c.border}`,
        borderRadius: 12,
        padding: 24,
        boxShadow: scheme === 'dark' ? 'none' : '0 1px 2px oklch(0 0 0 / 0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        color: c.text,
        fontFamily: 'inherit',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary external logo URL typed by the operator
          <img src={logo} alt="" style={{ height: 32, width: 'auto', maxWidth: 140, objectFit: 'contain', alignSelf: 'flex-start' }} />
        ) : name ? (
          <div
            style={{
              height: 32,
              width: 32,
              borderRadius: 8,
              background: accent,
              color: onAccent,
              display: 'grid',
              placeItems: 'center',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {name.charAt(0).toUpperCase()}
          </div>
        ) : null}
        <div>
          <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.3 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 13, color: c.muted, marginTop: 4 }}>{subtitle}</div>}
        </div>
      </div>

      {nothing ? (
        <div style={{ fontSize: 12, color: c.muted, border: `1px solid ${c.border}`, borderRadius: 8, padding: 12 }}>
          {m('unavailable')}
        </div>
      ) : (
        <>
          {hasPrimaryForm && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={label}>{m('email')}</div>
                <div style={field}>{m('emailPlaceholder')}</div>
              </div>
              {strategies.password && (
                <div>
                  <div style={{ ...label, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{m('password')}</span>
                    <span style={{ color: c.muted, fontWeight: 400 }}>{m('forgotPassword')}</span>
                  </div>
                  <div style={field}>••••••••</div>
                </div>
              )}
              <div style={primary}>
                {strategies.password ? m('submit') : strategies.email_code ? m('sendCode') : m('sendMagicLink')}
              </div>
            </div>
          )}
          {alternatives.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {hasPrimaryForm && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: c.muted, fontSize: 11 }}>
                  <span style={{ flex: 1, height: 1, background: c.border }} />
                  {m('or')}
                  <span style={{ flex: 1, height: 1, background: c.border }} />
                </div>
              )}
              {alternatives}
            </div>
          )}
          {strategies.password && (
            <div style={{ fontSize: 12, color: c.muted, textAlign: 'center' }}>
              {m('noAccount')} <span style={{ color: c.text, fontWeight: 500 }}>{m('createAccount')}</span>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div
      style={{ background: c.canvas, borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}
    >
      {branding.layout === 'split' && (
        <div
          style={{
            width: 320,
            maxWidth: '100%',
            borderRadius: 12,
            padding: '18px 20px',
            background: accent,
            color: onAccent,
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          {name || m('titleGeneric')}
        </div>
      )}
      {card}
      {!hideBranding && <div style={{ fontSize: 11, color: c.muted }}>{m('protectedBy')}</div>}
    </div>
  );
}
