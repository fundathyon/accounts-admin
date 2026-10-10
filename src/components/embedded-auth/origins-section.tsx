'use client';

import { Alert } from '@foundathyon/community-ui';
import { useI18n } from '@/context/i18n-context';
import { EMBEDDED_AUTH_LIMITS, checkOrigin, checkRedirect } from '@/lib/embedded-auth';
import { UrlListEditor } from './url-list-editor';

interface OriginsSectionProps {
  origins: string[];
  redirects: string[];
  onOriginsChange: (values: string[]) => void;
  onRedirectsChange: (values: string[]) => void;
  /** Visible field errors keyed by backend path (`allowed_origins[0]`, `redirect_urls`…). */
  errors: Record<string, string>;
  magicLinkSelected: boolean;
}

/**
 * Where the components may run (allowed origins → CORS of the embedded
 * requests) and where a magic link may send the user back (redirect URLs).
 */
export function OriginsSection({
  origins,
  redirects,
  onOriginsChange,
  onRedirectsChange,
  errors,
  magicLinkSelected,
}: OriginsSectionProps) {
  const { t } = useI18n();

  // "Se guardará como …" when the canonical form differs from what was typed.
  const originHint = (index: number) => {
    const raw = origins[index] ?? '';
    const res = checkOrigin(raw);
    return 'origin' in res && res.origin !== raw.trim() ? t('embeddedAuth.origins.savedAs', { value: res.origin }) : null;
  };
  const redirectHint = (index: number) => {
    const raw = redirects[index] ?? '';
    const res = checkRedirect(raw);
    return 'redirect' in res && res.redirect !== raw.trim()
      ? t('embeddedAuth.origins.savedAs', { value: res.redirect })
      : null;
  };

  return (
    <div className="space-y-8">
      <UrlListEditor
        label={t('embeddedAuth.origins.title')}
        description={t('embeddedAuth.origins.desc')}
        values={origins}
        onChange={onOriginsChange}
        max={EMBEDDED_AUTH_LIMITS.maxOrigins}
        placeholder="https://app.example.com"
        addLabel={t('embeddedAuth.origins.add')}
        removeLabel={t('embeddedAuth.origins.remove')}
        rowLabel={(i) => t('embeddedAuth.origins.rowLabel', { n: i + 1 })}
        rowError={(i) => errors[`allowed_origins[${i}]`] ?? null}
        rowHint={originHint}
        listError={errors.allowed_origins ?? null}
        countLabel={t('embeddedAuth.origins.count', { count: origins.length, max: EMBEDDED_AUTH_LIMITS.maxOrigins })}
        emptyLabel={t('embeddedAuth.origins.empty')}
      />

      <UrlListEditor
        label={t('embeddedAuth.redirects.title')}
        description={t('embeddedAuth.redirects.desc')}
        values={redirects}
        onChange={onRedirectsChange}
        max={EMBEDDED_AUTH_LIMITS.maxRedirectUrls}
        placeholder="https://app.example.com/login"
        addLabel={t('embeddedAuth.redirects.add')}
        removeLabel={t('embeddedAuth.redirects.remove')}
        rowLabel={(i) => t('embeddedAuth.redirects.rowLabel', { n: i + 1 })}
        rowError={(i) => errors[`redirect_urls[${i}]`] ?? null}
        rowHint={redirectHint}
        listError={errors.redirect_urls ?? null}
        countLabel={t('embeddedAuth.origins.count', { count: redirects.length, max: EMBEDDED_AUTH_LIMITS.maxRedirectUrls })}
        emptyLabel={t('embeddedAuth.redirects.empty')}
      />

      {magicLinkSelected && redirects.length === 0 && (
        <Alert tone="warning" title={t('embeddedAuth.redirects.magicLinkNeedsOne')} />
      )}
    </div>
  );
}
