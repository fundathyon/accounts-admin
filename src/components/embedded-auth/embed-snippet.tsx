'use client';

import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import { Alert, CodeBlock, FormField, IconButton, Input, Text, buttonVariants } from '@foundathyon/community-ui';
import { useI18n } from '@/context/i18n-context';
import { buildAdminHref, cn } from '@/lib/utils';

interface EmbedSnippets {
  html: string;
  js: string;
  backend: string;
}

/** Comment lines of the snippets, in the operator's language. */
export interface EmbedSnippetComments {
  loadScript: string;
  placeLogin: string;
  userButton: string;
  token: string;
  verifyKey: string;
  verifyClaims: string;
}

/**
 * The integration snippets. Only the PUBLISHABLE key ever goes in here — the
 * secret key the admin holds must never reach a page the integrator ships.
 */
export function buildEmbedSnippets({
  baseUrl,
  publishableKey,
  locale,
  comments,
}: {
  baseUrl: string;
  publishableKey: string;
  locale: string;
  comments: EmbedSnippetComments;
}): EmbedSnippets {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const html = [
    `<!-- ${comments.loadScript} -->`,
    `<script src="${base}/ui/v1/accounts.js"`,
    `        data-publishable-key="${publishableKey}" defer></script>`,
    '',
    `<!-- ${comments.placeLogin} -->`,
    `<accounts-sign-in after-sign-in-url="/dashboard" locale="${locale}"></accounts-sign-in>`,
    '',
    `<!-- ${comments.userButton} -->`,
    '<accounts-user-button after-sign-out-url="/"></accounts-user-button>',
  ].join('\n');
  const js = [
    'await Accounts.ready;',
    '',
    "Accounts.on('signed-in', ({ user }) => console.log(user.id, user.email));",
    "Accounts.on('signed-out', () => location.assign('/'));",
    '',
    `// ${comments.token}`,
    'const token = await Accounts.getToken();',
    "await fetch('/api/orders', { headers: { Authorization: 'Bearer ' + token } });",
  ].join('\n');
  const backend = [
    `# ${comments.verifyKey}`,
    // Pro: the app's own RS256 key, read with the SECRET key (server side only).
    `curl -H "X-API-KEY: $ACCOUNTS_SECRET_KEY" ${base}/api/v1/system/public-key-jwt`,
    '',
    `# ${comments.verifyClaims}`,
  ].join('\n');
  return { html, js, backend };
}

interface EmbedSnippetProps {
  /** Browser-reachable Accounts base URL (with ROOT_PATH), or '' while unknown. */
  baseUrl: string;
  /** The URL that came from the server (INTERNAL_API_URL), to offer a reset. */
  defaultBaseUrl: string;
  onBaseUrlChange: (value: string) => void;
  publishableKey: string;
  locale: string;
  enabled: boolean;
}

/** "Instalación" tab: the snippet to paste, with the app's publishable key. */
export function EmbedSnippet({ baseUrl, defaultBaseUrl, onBaseUrlChange, publishableKey, locale, enabled }: EmbedSnippetProps) {
  const { t } = useI18n();
  const key = publishableKey || t('embeddedAuth.install.publishableKeyPlaceholder');
  const snippets = buildEmbedSnippets({
    baseUrl: baseUrl || 'https://accounts.example.com',
    publishableKey: key,
    locale,
    comments: {
      loadScript: t('embeddedAuth.install.commentLoadScript'),
      placeLogin: t('embeddedAuth.install.commentPlaceLogin'),
      userButton: t('embeddedAuth.install.commentUserButton'),
      token: t('embeddedAuth.install.commentToken'),
      verifyKey: t('embeddedAuth.install.commentVerifyKey'),
      verifyClaims: t('embeddedAuth.install.commentVerifyClaims'),
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <Text variant="label" as="div">{t('embeddedAuth.install.title')}</Text>
        <Text variant="caption" tone="muted" as="div" className="mt-0.5">
          {t('embeddedAuth.install.desc')}
        </Text>
      </div>

      {!enabled && <Alert tone="warning" title={t('embeddedAuth.install.notEnabled')}>{t('embeddedAuth.install.notEnabledDesc')}</Alert>}

      {!publishableKey && (
        <Alert
          tone="warning"
          title={t('embeddedAuth.install.publishableKeyMissing')}
          action={
            <Link href={buildAdminHref('/settings')} className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}>
              {t('users.goToSettings')}
            </Link>
          }
        >
          {t('embeddedAuth.install.publishableKeyMissingDesc')}
        </Alert>
      )}

      <FormField label={t('embeddedAuth.install.baseUrl')} description={t('embeddedAuth.install.baseUrlHint')}>
        <div className="flex items-center gap-2">
          <Input
            value={baseUrl}
            onChange={(e) => onBaseUrlChange(e.target.value)}
            placeholder="https://auth.example.com/accounts"
            spellCheck={false}
            inputMode="url"
            wrapperClassName="flex-1"
            className="font-mono text-xs"
          />
          {defaultBaseUrl && baseUrl !== defaultBaseUrl && (
            <IconButton
              type="button"
              icon={RotateCcw}
              label={t('embeddedAuth.install.resetBaseUrl')}
              variant="ghost"
              onClick={() => onBaseUrlChange(defaultBaseUrl)}
            />
          )}
        </div>
      </FormField>

      <CodeBlock
        tabs={[
          { label: t('embeddedAuth.install.tabHtml'), code: snippets.html, language: 'text' },
          { label: t('embeddedAuth.install.tabJs'), code: snippets.js, language: 'text' },
          { label: t('embeddedAuth.install.tabBackend'), code: snippets.backend, language: 'bash' },
        ]}
        tabsLabel={t('embeddedAuth.install.title')}
        copy
        copyLabel={t('common.copy')}
        copiedLabel={t('common.copied')}
      />
    </div>
  );
}
