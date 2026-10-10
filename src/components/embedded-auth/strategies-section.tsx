'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Alert, Checkbox, Text } from '@foundathyon/community-ui';
import { useI18n } from '@/context/i18n-context';
import { OAuthProviderLogo } from '@/components/oauth-provider-logo';
import { buildAdminHref } from '@/lib/utils';
import { normalizeProvider } from '@/lib/embedded-auth';
import type { EmbeddedAuthStrategies } from '@/lib/admin-types';

interface StrategiesSectionProps {
  strategies: EmbeddedAuthStrategies;
  available: EmbeddedAuthStrategies;
  onChange: (next: EmbeddedAuthStrategies) => void;
  /** Visible field errors keyed by backend path (`strategies`, `strategies.oauth[0]`…). */
  errors: Record<string, string>;
  hasRedirects: boolean;
}

type BuiltIn = 'password' | 'email_code' | 'magic_link';

const BUILT_IN: { key: BuiltIn; label: string; desc: string; unavailable: string }[] = [
  {
    key: 'password',
    label: 'embeddedAuth.strategies.password',
    desc: 'embeddedAuth.strategies.passwordDesc',
    unavailable: 'embeddedAuth.strategies.unavailablePassword',
  },
  {
    key: 'email_code',
    label: 'embeddedAuth.strategies.emailCode',
    desc: 'embeddedAuth.strategies.emailCodeDesc',
    unavailable: 'embeddedAuth.strategies.unavailableEmailCode',
  },
  {
    key: 'magic_link',
    label: 'embeddedAuth.strategies.magicLink',
    desc: 'embeddedAuth.strategies.magicLinkDesc',
    unavailable: 'embeddedAuth.strategies.unavailableMagicLink',
  },
];

function providerName(provider: string): string {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

/**
 * Sign-in methods the components offer. Each one must be available in the app
 * (email_auth active and its email_code / magic_link nodes enabled; OAuth
 * providers configured and enabled). An unavailable method is disabled with
 * the reason — but if it is already ticked it stays clickable, so it can be
 * unticked (the backend rejects saving an unavailable method).
 */
export function StrategiesSection({ strategies, available, onChange, errors, hasRedirects }: StrategiesSectionProps) {
  const { t } = useI18n();
  const behaviorsHref = buildAdminHref('/behaviors');
  const oauthHref = buildAdminHref('/oauth-providers');

  const availableProviders = available.oauth.map(normalizeProvider);
  // Enabled providers first, then any saved provider that is no longer available.
  const providers = [
    ...availableProviders,
    ...strategies.oauth.filter((p) => !availableProviders.includes(p)),
  ].filter((p, i, list) => list.indexOf(p) === i);

  const toggleProvider = (provider: string, checked: boolean) => {
    const oauth = checked
      ? [...strategies.oauth.filter((p) => p !== provider), provider]
      : strategies.oauth.filter((p) => p !== provider);
    onChange({ ...strategies, oauth });
  };

  const explain = (text: string, href: string, linkLabel: string): ReactNode => (
    <>
      {text}{' '}
      <Link href={href} className="underline underline-offset-2 hover:text-text">
        {linkLabel}
      </Link>
    </>
  );

  return (
    <div className="space-y-6">
      <div>
        <Text variant="label" as="div">{t('embeddedAuth.strategies.title')}</Text>
        <Text variant="caption" tone="muted" as="div" className="mt-0.5">
          {t('embeddedAuth.strategies.desc')}
        </Text>
      </div>

      <div className="space-y-4">
        {BUILT_IN.map(({ key, label, desc, unavailable }) => {
          const checked = strategies[key];
          const isAvailable = available[key];
          const error = errors[`strategies.${key}`];
          let description: ReactNode = t(desc);
          if (!isAvailable) {
            description = explain(t(unavailable), behaviorsHref, t('embeddedAuth.strategies.goToBehaviors'));
          } else if (key === 'magic_link' && checked && !hasRedirects) {
            description = t('embeddedAuth.redirects.magicLinkNeedsOne');
          }
          return (
            <div key={key} className="space-y-1">
              <Checkbox
                checked={checked}
                disabled={!isAvailable && !checked}
                onCheckedChange={(value) => onChange({ ...strategies, [key]: value === true })}
                label={t(label)}
                description={description}
              />
              {error && (
                <Text variant="caption" as="div" className="pl-6 text-danger" role="alert">
                  {error}
                </Text>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-3 border-t border-border pt-5">
        <div>
          <Text variant="label" as="div">{t('embeddedAuth.strategies.oauth')}</Text>
          <Text variant="caption" tone="muted" as="div" className="mt-0.5">
            {t('embeddedAuth.strategies.oauthDesc')}
          </Text>
        </div>
        {providers.length === 0 ? (
          <Text variant="caption" tone="muted" as="div">
            {explain(t('embeddedAuth.strategies.noOAuth'), oauthHref, t('embeddedAuth.strategies.goToOAuth'))}
          </Text>
        ) : (
          <div className="space-y-3">
            {providers.map((provider) => {
              const checked = strategies.oauth.includes(provider);
              const isAvailable = availableProviders.includes(provider);
              const index = strategies.oauth.indexOf(provider);
              const error = index >= 0 ? errors[`strategies.oauth[${index}]`] : undefined;
              return (
                <div key={provider} className="space-y-1">
                  <Checkbox
                    checked={checked}
                    disabled={!isAvailable && !checked}
                    onCheckedChange={(value) => toggleProvider(provider, value === true)}
                    label={
                      <span className="inline-flex items-center gap-2">
                        <OAuthProviderLogo provider={provider} size={16} />
                        {providerName(provider)}
                      </span>
                    }
                    description={
                      isAvailable
                        ? undefined
                        : explain(t('embeddedAuth.strategies.unavailableOAuth'), oauthHref, t('embeddedAuth.strategies.goToOAuth'))
                    }
                  />
                  {error && (
                    <Text variant="caption" as="div" className="pl-6 text-danger" role="alert">
                      {error}
                    </Text>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {errors.strategies && <Alert tone="warning" title={errors.strategies} />}
    </div>
  );
}
