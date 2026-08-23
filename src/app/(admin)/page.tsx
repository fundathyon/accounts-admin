'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Fingerprint,
  Key,
  KeyRound,
  LogIn,
  Mail,
  Puzzle,
  Shield,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  Webhook,
  Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Heading,
  Icon,
  Inline,
  Skeleton,
  SkeletonGroup,
  Text,
  Tooltip,
  cn,
  formatRelativeDate,
} from '@foundathyon/community-ui';
import { useI18n } from '@/context/i18n-context';
import { useAdmin } from '@/context/admin-context';
import { buildAdminHref } from '@/lib/utils';
import { OAuthProviderLogo } from '@/components/oauth-provider-logo';
import type {
  APIKeyListItem,
  AppBehavior,
  OAuthConfig,
  Role,
  User,
  WebhookItem,
} from '@/lib/admin-types';

// ---------- API response shapes (dashboard-only, colocated) ----------

type DashboardStats = {
  users: number;
  webhooks: number;
  behaviors: number;
  api_keys: number;
  roles: number;
  oauth_configs: number;
};

type ApiEnvelope<T> = { success?: boolean; data?: T };

// One row of Recent Activity. The `kind` picks the icon and the copy — the
// timestamp is the entity's real `created_at`, never fabricated.
type ActivityRow =
  | { kind: 'user'; id: string; ts: string; name: string }
  | { kind: 'api_key'; id: string; ts: string; name: string; env: string }
  | { kind: 'webhook'; id: string; ts: string; name: string }
  | { kind: 'oauth'; id: string; ts: string; provider: string };

const ACTIVITY_LIMIT = 6;

// ---------- Helpers ----------

async function getJson<T>(url: string, secretKey: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { 'X-Secret-API-Key': secretKey },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as ApiEnvelope<T>;
    if (body?.success === false) return null;
    return (body?.data ?? null) as T | null;
  } catch {
    return null;
  }
}

function isEmailLogin(u: User) {
  return u.login_methods?.some((m) => m.entity_type === 'email') ?? false;
}
function hasOAuthLogin(u: User) {
  return u.login_methods?.some((m) => m.entity_type === 'oauth') ?? false;
}

// ---------- Page ----------

export default function DashboardPage() {
  const { apiUrl, savedSecretKey } = useAdmin();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [apiKeys, setApiKeys] = useState<APIKeyListItem[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [oauth, setOauth] = useState<OAuthConfig[]>([]);
  const [behaviors, setBehaviors] = useState<AppBehavior[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!savedSecretKey) {
      // No key configured — no fetch to do; leave `loading` in its initial
      // false-once-settled state via the resolved .then() below by short-
      // circuiting to null. Cancels the effect cleanly.
      Promise.resolve().then(() => {
        if (!cancelled) setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    // Every list endpoint is fetched in parallel; a single failure never
    // starves the rest — Promise.allSettled + null-tolerant getJson.
    Promise.all([
      getJson<DashboardStats>(apiUrl('/api/dashboard-stats'), savedSecretKey),
      getJson<User[]>(apiUrl('/api/users'), savedSecretKey),
      getJson<APIKeyListItem[]>(apiUrl('/api/api-keys'), savedSecretKey),
      getJson<WebhookItem[]>(apiUrl('/api/webhooks'), savedSecretKey),
      getJson<OAuthConfig[]>(apiUrl('/api/oauth-configs'), savedSecretKey),
      getJson<AppBehavior[]>(apiUrl('/api/behaviors'), savedSecretKey),
      getJson<Role[]>(apiUrl('/api/roles'), savedSecretKey),
    ]).then((r) => {
      if (cancelled) return;
      const [s, u, k, w, o, b, rl] = r;
      setStats(s);
      setUsers(Array.isArray(u) ? u : []);
      setApiKeys(Array.isArray(k) ? k : []);
      setWebhooks(Array.isArray(w) ? w : []);
      setOauth(Array.isArray(o) ? o : []);
      setBehaviors(Array.isArray(b) ? b : []);
      setRoles(Array.isArray(rl) ? rl : []);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [apiUrl, savedSecretKey]);

  const derived = useMemo(() => {
    const usersActive = users.length;
    const usersOauth = users.filter(hasOAuthLogin).length;
    const usersEmail = users.filter(isEmailLogin).length;

    const webhooksActive = webhooks.filter((w) => w.active).length;
    const behaviorsActive = behaviors.filter((b) => b.is_active).length;
    const apiKeysActive = apiKeys.filter((k) => k.is_active && !k.revoked_at).length;
    const apiKeysRevoked = apiKeys.filter((k) => !!k.revoked_at).length;

    const oauthEnabled = oauth.filter((o) => o.enabled).length;
    const enabledProviders = oauth
      .filter((o) => o.enabled)
      .map((o) => o.provider)
      .filter(Boolean);

    const activity: ActivityRow[] = [];
    users.slice(0, ACTIVITY_LIMIT).forEach((u) => {
      if (!u.created_at) return;
      activity.push({
        kind: 'user',
        id: u.id,
        ts: u.created_at,
        name: u.name || u.user_name || u.id,
      });
    });
    apiKeys.slice(0, ACTIVITY_LIMIT).forEach((k) => {
      if (!k.created_at) return;
      activity.push({
        kind: 'api_key',
        id: k.id,
        ts: k.created_at,
        name: k.name,
        env: k.environment,
      });
    });
    webhooks.slice(0, ACTIVITY_LIMIT).forEach((w) => {
      if (!w.created_at) return;
      activity.push({
        kind: 'webhook',
        id: w.id,
        ts: w.created_at,
        name: w.name,
      });
    });
    oauth.slice(0, ACTIVITY_LIMIT).forEach((o) => {
      activity.push({
        kind: 'oauth',
        id: o.id,
        ts: '', // OAuthConfig has no created_at in this API; keep it, sort demotes it.
        provider: o.name || o.provider,
      });
    });
    activity.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));

    return {
      usersActive,
      usersOauth,
      usersEmail,
      webhooksActive,
      behaviorsActive,
      apiKeysActive,
      apiKeysRevoked,
      oauthEnabled,
      enabledProviders,
      activity: activity.slice(0, ACTIVITY_LIMIT),
    };
  }, [users, apiKeys, webhooks, oauth, behaviors]);

  const behaviorActive = (code: string) =>
    behaviors.some((b) => b.behavior_code === code && b.is_active);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      {/* ---------- Header ---------- */}
      <header className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Inline gap={3} className="mb-1.5">
            <Heading level={1}>{t('dashboard.title')}</Heading>
            <Badge variant="outline">{t('dashboard.badge')}</Badge>
          </Inline>
          <Text tone="secondary" className="text-body">
            {t('dashboard.subtitle')}
          </Text>
        </div>
      </header>

      {/* ---------- Overview grid (6 metrics, real derived context) ---------- */}
      <SkeletonGroup busy={loading} label={t('dashboard.title')} className="mb-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricLinkCard
            icon={Users}
            label={t('dashboard.metrics.users')}
            value={stats?.users ?? users.length}
            context={
              (stats?.users ?? users.length) === 0
                ? t('dashboard.metrics.usersContextEmpty')
                : derived.usersOauth > 0
                  ? t('dashboard.metrics.usersContext', {
                      active: derived.usersActive,
                      oauth: derived.usersOauth,
                    })
                  : t('dashboard.metrics.usersContextSingle', {
                      count: stats?.users ?? users.length,
                    })
            }
            href="/users"
            loading={loading}
          />
          <MetricLinkCard
            icon={Webhook}
            label={t('dashboard.metrics.webhooks')}
            value={stats?.webhooks ?? webhooks.length}
            context={
              (stats?.webhooks ?? webhooks.length) === 0
                ? t('dashboard.metrics.webhooksContextEmpty')
                : t('dashboard.metrics.webhooksContext', {
                    active: derived.webhooksActive,
                    total: stats?.webhooks ?? webhooks.length,
                  })
            }
            href="/webhooks"
            loading={loading}
          />
          <MetricLinkCard
            icon={Puzzle}
            label={t('dashboard.metrics.behaviors')}
            value={behaviors.length || stats?.behaviors || 0}
            context={
              behaviors.length === 0
                ? t('dashboard.metrics.behaviorsContextEmpty')
                : t('dashboard.metrics.behaviorsContext', {
                    active: derived.behaviorsActive,
                    total: behaviors.length,
                  })
            }
            href="/behaviors"
            loading={loading}
          />
          <MetricLinkCard
            icon={Key}
            label={t('dashboard.metrics.apiKeys')}
            value={stats?.api_keys ?? apiKeys.length}
            context={
              (stats?.api_keys ?? apiKeys.length) === 0
                ? t('dashboard.metrics.apiKeysContextEmpty')
                : t('dashboard.metrics.apiKeysContext', {
                    active: derived.apiKeysActive,
                    revoked: derived.apiKeysRevoked,
                  })
            }
            href="/api-keys"
            loading={loading}
          />
          <MetricLinkCard
            icon={Shield}
            label={t('dashboard.metrics.roles')}
            value={stats?.roles ?? roles.length}
            context={
              (stats?.roles ?? roles.length) === 0
                ? t('dashboard.metrics.rolesContextEmpty')
                : t('dashboard.metrics.rolesContext', {
                    count: stats?.roles ?? roles.length,
                  })
            }
            href="/roles-policies"
            loading={loading}
          />
          <MetricLinkCard
            icon={LogIn}
            label={t('dashboard.metrics.oauth')}
            value={stats?.oauth_configs ?? oauth.length}
            context={
              (stats?.oauth_configs ?? oauth.length) === 0
                ? t('dashboard.metrics.oauthContextEmpty')
                : t('dashboard.metrics.oauthContext', {
                    enabled: derived.oauthEnabled,
                    total: stats?.oauth_configs ?? oauth.length,
                  })
            }
            href="/oauth-providers"
            loading={loading}
          />
        </div>
      </SkeletonGroup>

      {/* ---------- Split: activity + auth/quick actions ---------- */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Left column — Recent Activity, spans 2 on lg+ */}
        <Card className="lg:col-span-2">
          <CardHeader
            actions={
              derived.activity.length > 0 ? (
                <Link
                  href={buildAdminHref('/users')}
                  className="inline-flex items-center gap-1 rounded-sm text-body-sm text-text-secondary transition-colors hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {t('dashboard.sections.activityViewAll')}
                  <Icon icon={ArrowRight} size={12} />
                </Link>
              ) : null
            }
          >
            <div className="flex flex-col">
              <span>{t('dashboard.sections.activityTitle')}</span>
              <span className="text-body-sm font-normal text-text-secondary">
                {t('dashboard.sections.activitySubtitle')}
              </span>
            </div>
          </CardHeader>
          <CardBody className="pt-0">
            {loading ? (
              <ActivitySkeleton />
            ) : derived.activity.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title={t('dashboard.sections.activityEmptyTitle')}
                description={t('dashboard.sections.activityEmptyDescription')}
                action={
                  <Link
                    href={buildAdminHref('/users')}
                    className="inline-flex items-center"
                  >
                    <Button variant="secondary" leading={<Icon icon={UserPlus} size={14} />}>
                      {t('dashboard.sections.activityEmptyAction')}
                    </Button>
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {derived.activity.map((row) => (
                  <ActivityRowItem key={`${row.kind}:${row.id}`} row={row} t={t} />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Right column — Authentication + Quick actions */}
        <div className="flex flex-col gap-3">
          <Card>
            <CardHeader>
              <div className="flex flex-col">
                <span>{t('dashboard.sections.authTitle')}</span>
                <span className="text-body-sm font-normal text-text-secondary">
                  {t('dashboard.sections.authSubtitle')}
                </span>
              </div>
            </CardHeader>
            <CardBody className="pt-0">
              {loading ? (
                <AuthSkeleton />
              ) : (
                <ul className="divide-y divide-border">
                  <AuthRow
                    icon={Mail}
                    label={t('dashboard.auth.emailPassword')}
                    enabled={behaviorActive('email_auth')}
                    detail={
                      behaviorActive('email_auth')
                        ? t('dashboard.auth.enabled')
                        : t('dashboard.auth.disabled')
                    }
                    t={t}
                  />
                  <AuthRow
                    icon={Zap}
                    label={t('dashboard.auth.magicLink')}
                    enabled={behaviorActive('magic_link')}
                    detail={
                      behaviorActive('magic_link')
                        ? t('dashboard.auth.enabled')
                        : t('dashboard.auth.disabled')
                    }
                    t={t}
                  />
                  <AuthRow
                    icon={Fingerprint}
                    label={t('dashboard.auth.oauthProviders')}
                    enabled={derived.oauthEnabled > 0}
                    detail={
                      derived.oauthEnabled > 0
                        ? t('dashboard.auth.providersEnabled', {
                            count: derived.oauthEnabled,
                          })
                        : t('dashboard.auth.noProviders')
                    }
                    right={
                      derived.enabledProviders.length > 0 ? (
                        <ProviderIconTrail providers={derived.enabledProviders} />
                      ) : null
                    }
                    t={t}
                  />
                  <AuthRow
                    icon={BadgeCheck}
                    label={t('dashboard.auth.metadataSchema')}
                    enabled={behaviorActive('metadata_schema')}
                    detail={
                      behaviorActive('metadata_schema')
                        ? t('dashboard.auth.enabled')
                        : t('dashboard.auth.disabled')
                    }
                    t={t}
                  />
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <span>{t('dashboard.sections.quickActionsTitle')}</span>
            </CardHeader>
            <CardBody className="pt-0">
              <div className="grid grid-cols-1 gap-1.5">
                <QuickActionRow
                  icon={UserPlus}
                  label={t('dashboard.quickActions.createUser')}
                  href="/users"
                />
                <QuickActionRow
                  icon={KeyRound}
                  label={t('dashboard.quickActions.createApiKey')}
                  href="/api-keys"
                />
                <QuickActionRow
                  icon={Webhook}
                  label={t('dashboard.quickActions.createWebhook')}
                  href="/webhooks"
                />
                <QuickActionRow
                  icon={ShieldCheck}
                  label={t('dashboard.quickActions.createRole')}
                  href="/roles-policies"
                />
                <QuickActionRow
                  icon={LogIn}
                  label={t('dashboard.quickActions.configureOauth')}
                  href="/oauth-providers"
                />
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}

// ---------- Sub-components (colocated) ----------

interface MetricLinkCardProps {
  icon: typeof Users;
  label: string;
  value: number | string;
  context: string;
  href: string;
  loading: boolean;
}

// StatCard equivalent, but as an interactive link with hover feedback and a
// derived `context` line. Deliberately NOT using StatCard directly because we
// want (a) the whole card clickable, (b) a leading icon in a subtle badge —
// StatCard renders the icon in the overline slot, which reads as decoration.
function MetricLinkCard({ icon, label, value, context, href, loading }: MetricLinkCardProps) {
  return (
    <Link
      href={buildAdminHref(href)}
      className="group block outline-none focus-visible:rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <Card className="h-full transition-colors duration-[var(--fdn-dur-fast)] group-hover:bg-surface-hover">
        <CardBody className="flex items-start gap-3 p-4">
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-hover text-text-muted transition-colors group-hover:text-text"
          >
            <Icon icon={icon} size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-caption uppercase tracking-wide text-text-muted">
                {label}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              {loading ? (
                <Skeleton className="h-7 w-10" />
              ) : (
                <span className="text-h2 tabular-nums text-text">{value}</span>
              )}
            </div>
            {loading ? (
              <Skeleton className="mt-1.5 h-3 w-3/4" />
            ) : (
              <p className="mt-1 truncate text-caption text-text-muted">{context}</p>
            )}
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}

interface AuthRowProps {
  icon: typeof Mail;
  label: string;
  enabled: boolean;
  detail: string;
  right?: React.ReactNode;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function AuthRow({ icon, label, enabled, detail, right }: AuthRowProps) {
  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <span
        aria-hidden
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-lg bg-surface-hover',
          enabled ? 'text-text' : 'text-text-muted',
        )}
      >
        <Icon icon={icon} size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-body text-text">{label}</div>
        <div className="text-caption text-text-muted">{detail}</div>
      </div>
      {right ?? (
        <span
          aria-hidden
          className={cn(
            'size-2 shrink-0 rounded-full',
            enabled ? 'bg-success' : 'bg-text-muted',
          )}
        />
      )}
    </li>
  );
}

function ProviderIconTrail({ providers }: { providers: string[] }) {
  // Cap the row so a long list never displaces the status column.
  const visible = providers.slice(0, 4);
  const overflow = providers.length - visible.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((p) => (
        <Tooltip key={p} content={p}>
          <span className="grid size-6 place-items-center rounded-full border border-border bg-surface">
            <OAuthProviderLogo provider={p} size={14} />
          </span>
        </Tooltip>
      ))}
      {overflow > 0 ? (
        <span className="grid size-6 place-items-center rounded-full border border-border bg-surface text-caption text-text-muted">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

interface QuickActionRowProps {
  icon: typeof UserPlus;
  label: string;
  href: string;
}

function QuickActionRow({ icon, label, href }: QuickActionRowProps) {
  return (
    <Link
      href={buildAdminHref(href)}
      className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 outline-none transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <span className="grid size-7 place-items-center rounded-md bg-surface-hover text-text-muted transition-colors group-hover:text-text">
        <Icon icon={icon} size={14} />
      </span>
      <span className="flex-1 truncate text-body text-text">{label}</span>
      <Icon icon={ArrowRight} size={14} className="text-text-muted transition-colors group-hover:text-text" />
    </Link>
  );
}

function ActivityRowItem({
  row,
  t,
}: {
  row: ActivityRow;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const spec = activitySpec(row);
  const when = row.ts ? formatRelativeDate(row.ts) : null;
  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-hover text-text-muted"
      >
        <Icon icon={spec.icon} size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-body text-text">
          <span className="font-medium">{t(spec.titleKey)}</span>
          <span className="mx-1.5 text-text-muted">·</span>
          <span className="text-text-secondary">{t(spec.detailKey, spec.detailParams)}</span>
        </div>
      </div>
      {when ? (
        <Tooltip content={when.absolute}>
          <time className="shrink-0 whitespace-nowrap text-caption text-text-muted">
            {when.display}
          </time>
        </Tooltip>
      ) : null}
    </li>
  );
}

function activitySpec(row: ActivityRow) {
  switch (row.kind) {
    case 'user':
      return {
        icon: UserPlus,
        titleKey: 'dashboard.activity.userCreated',
        detailKey: 'dashboard.activity.userCreatedDetail',
        detailParams: { name: row.name } as Record<string, string | number>,
      };
    case 'api_key':
      return {
        icon: KeyRound,
        titleKey: 'dashboard.activity.apiKeyCreated',
        detailKey: 'dashboard.activity.apiKeyCreatedDetail',
        detailParams: { name: row.name, env: row.env },
      };
    case 'webhook':
      return {
        icon: Webhook,
        titleKey: 'dashboard.activity.webhookCreated',
        detailKey: 'dashboard.activity.webhookCreatedDetail',
        detailParams: { name: row.name },
      };
    case 'oauth':
      return {
        icon: LogIn,
        titleKey: 'dashboard.activity.oauthCreated',
        detailKey: 'dashboard.activity.oauthCreatedDetail',
        detailParams: { provider: row.provider },
      };
  }
}

function ActivitySkeleton() {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          <Skeleton variant="circle" className="size-8" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
          <Skeleton className="h-2.5 w-12" />
        </li>
      ))}
    </ul>
  );
}

function AuthSkeleton() {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          <Skeleton variant="circle" className="size-8" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-2.5 w-1/4" />
          </div>
          <Skeleton variant="circle" className="size-2" />
        </li>
      ))}
    </ul>
  );
}
