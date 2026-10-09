'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import { AppWindow, Key } from 'lucide-react';
import {
  Alert,
  Badge,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  Heading,
  Icon,
  SaveBar,
  Spinner,
  Tab,
  Tabs,
  TabsList,
  TabsPanel,
  Text,
  buttonVariants,
} from '@foundathyon/community-ui';
import { useAdmin } from '@/context/admin-context';
import { useEdition } from '@/context/edition-context';
import { useI18n } from '@/context/i18n-context';
import { buildAdminHref, cn } from '@/lib/utils';
import {
  EMBEDDED_AUTH_LIMITS,
  defaultEmbeddedAuthConfig,
  intersectStrategies,
  normalizeEmbeddedAuthBehavior,
  parseServerFieldErrors,
  validateEmbeddedAuthConfig,
  type EmbeddedAuthIssue,
  type ServerFieldError,
} from '@/lib/embedded-auth';
import type { EmbeddedAuthBehavior, EmbeddedAuthConfig } from '@/lib/admin-types';
import { OriginsSection } from '@/components/embedded-auth/origins-section';
import { StrategiesSection } from '@/components/embedded-auth/strategies-section';
import { BrandingSection } from '@/components/embedded-auth/branding-section';
import { EmbedSnippet } from '@/components/embedded-auth/embed-snippet';
import { EmbeddedAuthPreview } from '@/components/embedded-auth/embedded-auth-preview';

type TabId = 'origins' | 'strategies' | 'branding' | 'install';
const TABS: TabId[] = ['origins', 'strategies', 'branding', 'install'];

const INVALID_CONFIG_SCOPE = 'app_behaviors.embedded_auth.invalid_config';

const SCOPE_TO_I18N: Record<string, string> = {
  [INVALID_CONFIG_SCOPE]: 'embeddedAuth.errors.invalidConfig',
  'app_behaviors.embedded_auth.save_error': 'embeddedAuth.errors.saveError',
  'app_behaviors.embedded_auth.read_error': 'embeddedAuth.errors.readError',
};

interface ApiEnvelope {
  success?: boolean;
  data?: unknown;
  error?: { message?: string; scope?: string };
}

/** Which tab owns a backend field path. */
function tabOf(field: string): TabId {
  if (field.startsWith('strategies')) return 'strategies';
  if (field.startsWith('branding') || field === 'hide_branding') return 'branding';
  return 'origins';
}

/** Number of settings that differ from the saved config (SaveBar counter). */
function countChanges(a: EmbeddedAuthConfig, b: EmbeddedAuthConfig): number {
  const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);
  let n = 0;
  if (!same(a.allowed_origins, b.allowed_origins)) n++;
  if (!same(a.redirect_urls, b.redirect_urls)) n++;
  for (const k of ['password', 'email_code', 'magic_link'] as const) if (a.strategies[k] !== b.strategies[k]) n++;
  if (!same([...a.strategies.oauth].sort(), [...b.strategies.oauth].sort())) n++;
  for (const k of ['name', 'logo_url', 'accent', 'theme', 'layout', 'locale'] as const) {
    if (!same(a.branding[k], b.branding[k])) n++;
  }
  if (a.hide_branding !== b.hide_branding) n++;
  return n;
}

/** Max value a limit-type issue talks about. */
function issueMax(code: EmbeddedAuthIssue['code']): number | undefined {
  switch (code) {
    case 'origins_max': return EMBEDDED_AUTH_LIMITS.maxOrigins;
    case 'redirects_max': return EMBEDDED_AUTH_LIMITS.maxRedirectUrls;
    case 'name_too_long': return EMBEDDED_AUTH_LIMITS.maxNameLength;
    case 'too_long': return EMBEDDED_AUTH_LIMITS.maxUrlLength;
    default: return undefined;
  }
}

/** Codes hidden until the first save attempt: a just-added empty row is not an error yet. */
const DEFERRED_CODES = new Set<EmbeddedAuthIssue['code']>(['empty', 'origins_required']);

type LoadState = 'loading' | 'ready' | 'error' | 'unavailable';

function EmbeddedAuthEditor({ secretKey }: { secretKey: string }) {
  const { apiUrl, showNotification, savedPublishableKey } = useAdmin();
  const { t } = useI18n();
  const { resolvedTheme } = useTheme();
  const adminScheme = resolvedTheme === 'dark' ? 'dark' : 'light';

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [behavior, setBehavior] = useState<EmbeddedAuthBehavior | null>(null);
  const [draft, setDraft] = useState<EmbeddedAuthConfig>(defaultEmbeddedAuthConfig);
  const [defaultBaseUrl, setDefaultBaseUrl] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [tab, setTab] = useState<TabId>('origins');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  // A 422's field errors, valid only for the exact draft that was sent.
  const [serverErrors, setServerErrors] = useState<{ draft: string; list: ServerFieldError[] } | null>(null);

  const load = useCallback(async () => {
    try {
      const [res, baseRes] = await Promise.all([
        fetch(apiUrl('/api/behaviors/embedded-auth'), {
          headers: { 'X-Secret-API-Key': secretKey },
          cache: 'no-store',
        }),
        // Same browser-reachable base the OAuth page uses for the Callback URI.
        fetch(apiUrl('/api/oauth-configs/callback-base'), { cache: 'no-store' }).catch(() => null),
      ]);
      const data = (await res.json().catch(() => null)) as ApiEnvelope | null;
      const base = baseRes?.ok ? ((await baseRes.json().catch(() => null)) as { data?: { base_url?: unknown } } | null) : null;
      const baseValue = typeof base?.data?.base_url === 'string' ? base.data.base_url : '';
      setDefaultBaseUrl(baseValue);
      setBaseUrl(baseValue);

      // Community backends (and older Pro builds) answer a JSON 404 here.
      if (res.status === 404) {
        setLoadState('unavailable');
        return;
      }
      if (!res.ok || !data?.success || !data.data) {
        setLoadError(data?.error?.message ?? '');
        setLoadState('error');
        return;
      }
      const next = normalizeEmbeddedAuthBehavior(data.data);
      setBehavior(next);
      setDraft(next.config);
      setSubmitted(false);
      setServerErrors(null);
      setLoadState('ready');
    } catch {
      setLoadError('');
      setLoadState('error');
    }
  }, [apiUrl, secretKey]);

  useEffect(() => {
    load();
  }, [load]);

  const retry = () => {
    setLoadState('loading');
    load();
  };

  if (loadState === 'loading') {
    return (
      <div className="py-20 flex justify-center">
        <Spinner size={20} label={t('common.loading')} className="text-accent" />
      </div>
    );
  }
  if (loadState === 'unavailable') {
    return (
      <Card>
        <EmptyState
          icon={AppWindow}
          title={t('embeddedAuth.unavailableTitle')}
          description={t('embeddedAuth.unavailableDesc')}
          action={
            <Link href={buildAdminHref('/')} className={cn(buttonVariants({ variant: 'secondary' }))}>
              {t('embeddedAuth.backToDashboard')}
            </Link>
          }
        />
      </Card>
    );
  }
  if (loadState === 'error' || !behavior) {
    return (
      <Card>
        <ErrorState
          title={t('embeddedAuth.loadError')}
          description={loadError || t('embeddedAuth.loadErrorDesc')}
          retry={{ label: t('common.retry'), onClick: retry }}
          copyLabel={t('common.copy')}
          copiedLabel={t('common.copied')}
        />
      </Card>
    );
  }

  const available = behavior.available;
  const draftJson = JSON.stringify(draft);
  const dirty = draftJson !== JSON.stringify(behavior.config);
  const changes = dirty ? Math.max(1, countChanges(draft, behavior.config)) : 0;

  const issueText = (issue: EmbeddedAuthIssue) => {
    const p = issue.params ?? {};
    return t(`embeddedAuth.issues.${issue.code}`, {
      ...p,
      n: typeof p.index === 'number' ? p.index + 1 : '',
      max: issueMax(issue.code) ?? '',
    });
  };

  // Field errors shown in place: the live mirror of the backend rules plus the
  // last 422 (while the draft is still the one that was sent).
  const errors: Record<string, string> = {};
  for (const issue of validateEmbeddedAuthConfig(draft, available)) {
    if (!submitted && DEFERRED_CODES.has(issue.code)) continue;
    errors[issue.field] ??= issueText(issue);
  }
  const activeServerErrors = serverErrors && serverErrors.draft === draftJson ? serverErrors.list : [];
  for (const e of activeServerErrors) {
    errors[e.field] ??= e.code ? issueText({ field: e.field, code: e.code }) : e.message;
  }
  const tabHasError = (id: TabId) => Object.keys(errors).some((field) => tabOf(field) === id);

  // Saved strategies the app no longer has: stored, but not offered today.
  const effective = intersectStrategies(behavior.config.strategies, available);
  const lost = [
    ...(['password', 'email_code', 'magic_link'] as const)
      .filter((k) => behavior.config.strategies[k] && !effective[k])
      .map((k) => t(`embeddedAuth.strategies.${k === 'email_code' ? 'emailCode' : k === 'magic_link' ? 'magicLink' : 'password'}`)),
    ...behavior.config.strategies.oauth.filter((p) => !effective.oauth.includes(p)),
  ];

  const save = async () => {
    const issues = validateEmbeddedAuthConfig(draft, available);
    if (issues.length > 0) {
      setSubmitted(true);
      setTab(tabOf(issues[0].field));
      showNotification(t('embeddedAuth.fixErrors', { count: issues.length }), 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(apiUrl('/api/behaviors/embedded-auth'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Secret-API-Key': secretKey },
        body: JSON.stringify(draft),
      });
      const data = (await res.json().catch(() => null)) as ApiEnvelope | null;
      if (res.ok && data?.success && data.data) {
        const next = normalizeEmbeddedAuthBehavior(data.data);
        setBehavior(next);
        setDraft(next.config);
        setSubmitted(false);
        setServerErrors(null);
        showNotification(t('embeddedAuth.saveSuccess'), 'success');
        return;
      }
      const scope = data?.error?.scope ?? '';
      if (scope === INVALID_CONFIG_SCOPE) {
        const list = parseServerFieldErrors(data?.error?.message ?? '');
        setServerErrors({ draft: draftJson, list });
        setSubmitted(true);
        if (list[0]) setTab(tabOf(list[0].field));
      }
      const key = SCOPE_TO_I18N[scope];
      showNotification(key ? t(key) : data?.error?.message || t('embeddedAuth.saveError'), 'error');
    } catch {
      showNotification(t('embeddedAuth.saveError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setDraft(behavior.config);
    setSubmitted(false);
    setServerErrors(null);
  };

  const enabled = behavior.effective.enabled;
  const statusText = enabled
    ? t('embeddedAuth.status.enabledDesc', { count: behavior.config.allowed_origins.length })
    : behavior.id
      ? t('embeddedAuth.status.disabledDesc')
      : t('embeddedAuth.status.notConfigured');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Badge tone={enabled ? 'success' : 'neutral'} dot>
          {enabled ? t('embeddedAuth.status.enabled') : t('embeddedAuth.status.disabled')}
        </Badge>
        <Text variant="caption" tone="muted">{statusText}</Text>
        {behavior.updated_at && (
          <Text variant="caption" tone="muted">
            · {t('embeddedAuth.status.updatedAt', { date: new Date(behavior.updated_at).toLocaleString() })}
          </Text>
        )}
        {behavior.app_id && (
          <Text variant="code" tone="muted" className="ml-auto">
            app_id: {behavior.app_id}
          </Text>
        )}
      </div>

      {lost.length > 0 && (
        <Alert tone="warning" title={t('embeddedAuth.strategies.lostTitle')}>
          {t('embeddedAuth.strategies.lostDesc', { list: lost.join(', ') })}
        </Alert>
      )}

      {activeServerErrors.length > 0 && (
        <Alert tone="danger" title={t('embeddedAuth.errors.invalidConfig')}>
          <ul className="list-disc pl-4">
            {activeServerErrors.map((e) => (
              <li key={e.field}>
                <span className="font-mono">{e.field}</span>: {e.code ? issueText({ field: e.field, code: e.code }) : e.message}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardBody className="p-6">
              <Tabs value={tab} onValueChange={(value) => setTab(value as TabId)}>
                <TabsList className="overflow-x-auto overflow-y-hidden">
                  {TABS.map((id) => (
                    <Tab key={id} value={id} className="shrink-0 whitespace-nowrap">
                      {t(`embeddedAuth.tabs.${id}`)}
                      {tabHasError(id) && (
                        <span className="size-1.5 rounded-full bg-danger" role="img" aria-label={t('embeddedAuth.tabHasErrors')} />
                      )}
                    </Tab>
                  ))}
                </TabsList>
                <TabsPanel value="origins" className="pt-2">
                  <OriginsSection
                    origins={draft.allowed_origins}
                    redirects={draft.redirect_urls}
                    onOriginsChange={(allowed_origins) => setDraft((d) => ({ ...d, allowed_origins }))}
                    onRedirectsChange={(redirect_urls) => setDraft((d) => ({ ...d, redirect_urls }))}
                    errors={errors}
                    magicLinkSelected={draft.strategies.magic_link}
                  />
                </TabsPanel>
                <TabsPanel value="strategies" className="pt-2">
                  <StrategiesSection
                    strategies={draft.strategies}
                    available={available}
                    onChange={(strategies) => setDraft((d) => ({ ...d, strategies }))}
                    errors={errors}
                    hasRedirects={draft.redirect_urls.length > 0}
                  />
                </TabsPanel>
                <TabsPanel value="branding" className="pt-2">
                  <BrandingSection
                    branding={draft.branding}
                    hideBranding={draft.hide_branding}
                    onChange={(branding) => setDraft((d) => ({ ...d, branding }))}
                    onHideBrandingChange={(hide_branding) => setDraft((d) => ({ ...d, hide_branding }))}
                    errors={errors}
                    scheme={adminScheme}
                  />
                </TabsPanel>
                <TabsPanel value="install" className="pt-2">
                  <EmbedSnippet
                    baseUrl={baseUrl}
                    defaultBaseUrl={defaultBaseUrl}
                    onBaseUrlChange={setBaseUrl}
                    publishableKey={savedPublishableKey}
                    locale={draft.branding.locale}
                    enabled={enabled}
                  />
                </TabsPanel>
              </Tabs>
            </CardBody>
          </Card>

          {dirty && (
            <SaveBar
              aria-label={t('embeddedAuth.saveBarLabel')}
              count={changes}
              countLabel={(count) => t('embeddedAuth.unsavedChanges', { count })}
              onDiscard={discard}
              onSave={save}
              saving={saving}
              discardLabel={t('embeddedAuth.discard')}
              saveLabel={t('embeddedAuth.save')}
            />
          )}
        </div>

        <Card className="xl:sticky xl:top-0">
          <CardBody className="p-4">
            <EmbeddedAuthPreview config={draft} available={available} adminScheme={adminScheme} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default function EmbeddedAuthPage() {
  const { t } = useI18n();
  const { isPro, loading: editionLoading } = useEdition();
  const { savedSecretKey } = useAdmin();
  const settingsHref = buildAdminHref('/settings');

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <Heading level={1} className="flex items-center gap-3">
            <Icon icon={AppWindow} size={20} className="text-accent" />
            {t('sidebar.embeddedAuth')}
            <Badge variant="outline" tone="info">{t('embeddedAuth.proBadge')}</Badge>
          </Heading>
          <Text variant="caption" tone="muted" className="mt-1 block max-w-2xl">
            {t('embeddedAuth.desc')}
          </Text>
        </div>
        {isPro && !savedSecretKey && (
          <Link
            href={settingsHref}
            className={cn(
              buttonVariants({ variant: 'secondary' }),
              'gap-2 border-amber-500/20 text-amber-500 hover:bg-amber-500/10'
            )}
          >
            <Icon icon={Key} size={16} /> {t('embeddedAuth.configSecretKey')}
          </Link>
        )}
      </div>

      {editionLoading ? (
        <div className="py-20 flex justify-center">
          <Spinner size={20} label={t('common.loading')} className="text-accent" />
        </div>
      ) : !isPro ? (
        // Reached by URL on a Community backend: no embedded-auth call is made.
        <Card>
          <EmptyState
            icon={AppWindow}
            title={t('embeddedAuth.proOnlyTitle')}
            description={t('embeddedAuth.proOnlyDesc')}
            action={
              <Link href={buildAdminHref('/')} className={cn(buttonVariants({ variant: 'secondary' }))}>
                {t('embeddedAuth.backToDashboard')}
              </Link>
            }
          />
        </Card>
      ) : !savedSecretKey ? (
        <Card className="border-amber-500/20">
          <EmptyState
            icon={Key}
            title={<span className="text-amber-300">{t('embeddedAuth.secretKeyRequired')}</span>}
            description={t('embeddedAuth.secretKeyRequiredDesc')}
            action={
              <Link href={settingsHref} className={cn(buttonVariants({ variant: 'primary' }))}>
                {t('users.goToSettings')}
              </Link>
            }
          />
        </Card>
      ) : (
        <EmbeddedAuthEditor key={savedSecretKey} secretKey={savedSecretKey} />
      )}
    </motion.div>
  );
}
