'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Puzzle } from 'lucide-react';
import { Card, Heading, Icon, Text } from '@foundathyon/community-ui';
import { AdminDataTable } from '@/components/admin-data-table';
import { Badge } from '@/components/fdn/badge';
import { Button } from '@/components/fdn/button';
import { ScreenLoadError, ScreenLoading } from '@/components/security-screen/screen-states';
import { SecurityScreen } from '@/components/security-screen/security-screen';
import { useAdmin } from '@/context/admin-context';
import { useEdition } from '@/context/edition-context';
import { useI18n } from '@/context/i18n-context';
import { apiError, type Envelope } from '@/lib/api-envelope';
import { behaviorScreen, behaviorScreens } from '@/lib/behaviors';
import { buildAdminHref } from '@/lib/utils';
import type { AppBehavior } from '@/lib/admin-types';
import { NewBehaviorDialog } from './_components/new-behavior-dialog';

type Config = Record<string, unknown>;

function timestampOf(value: string): number | null {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function BehaviorCard({ behavior, config, href }: { behavior: AppBehavior; config?: Config; href: string }) {
  const { t, locale } = useI18n();
  const keys = config ? Object.keys(config) : null;
  const identifier = typeof config?.identifier === 'string' && config.identifier ? config.identifier : behavior.behavior_code;
  const shortDate = (value: string) => new Date(value).toLocaleDateString(locale);

  return (
    <Link href={href}>
      <Card className="h-full gap-3 p-4 transition-colors hover:border-accent-border">
        <div className="flex items-start justify-between gap-2">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-bg-subtle text-text-muted">
            <Icon icon={Puzzle} size={20} />
          </div>
          <Badge variant="tonal" tone={behavior.is_active ? 'success' : 'neutral'} className="shrink-0">
            {behavior.is_active ? t('common.active') : t('behaviors.inactive')}
          </Badge>
        </div>
        <div className="min-w-0">
          <Heading level={2} visual="h5">{behavior.behavior_code}</Heading>
          <p className="mt-0.5 font-mono text-xs text-text-muted truncate">{behavior.id}</p>
        </div>
        <div className="rounded-md bg-bg-subtle px-2 py-1.5 text-xs text-text-muted space-y-1">
          <p>
            {t('behaviors.list.identifier')} <span className="font-medium text-text">{identifier}</span>
          </p>
          {keys && (
            <>
              <p className="line-clamp-2">
                {keys.length === 0
                  ? t('behaviors.list.noConfig')
                  : `${keys.slice(0, 4).join(', ')}${keys.length > 4 ? '…' : ''}`}
              </p>
              <p>
                {keys.length === 1
                  ? t('behaviors.list.configKeysOne')
                  : t('behaviors.list.configKeysMany', { count: keys.length })}
              </p>
            </>
          )}
        </div>
        <div className="mt-auto border-t border-border pt-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-text-muted">{t('behaviors.updated')}</span>
            <span className="text-text">{shortDate(behavior.updated_at)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">{t('behaviors.created')}</span>
            <span className="text-text">{shortDate(behavior.created_at)}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function BehaviorsList({ secretKey }: { secretKey: string }) {
  const { apiUrl } = useAdmin();
  const { t } = useI18n();
  const { isPro } = useEdition();
  const [behaviors, setBehaviors] = useState<AppBehavior[]>([]);
  const [configs, setConfigs] = useState<Record<string, Config>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const headers = { 'X-Secret-API-Key': secretKey };
    try {
      const res = await fetch(apiUrl('/api/behaviors'), { headers, cache: 'no-store' });
      const json = (await res.json().catch(() => null)) as Envelope | null;
      if (!res.ok) {
        setLoadError(apiError(json)?.message ?? t('behaviors.errorLoad'));
        return;
      }
      const rows = (json?.data ?? []) as AppBehavior[];
      setBehaviors(rows);
      setLoading(false);

      // The list endpoint leaves the config out; the cards' summary comes from
      // each detail and simply stays out if one fails.
      const details = await Promise.all(
        rows.map(async (row) => {
          try {
            const detail = await fetch(apiUrl(`/api/behaviors/${row.id}`), { headers, cache: 'no-store' });
            const body = (await detail.json()) as { data?: { config?: Config } };
            return detail.ok ? ([row.id, body.data?.config ?? {}] as const) : null;
          } catch {
            return null;
          }
        }),
      );
      setConfigs(Object.fromEntries(details.filter((entry) => entry !== null)));
    } catch {
      setLoadError(t('securityScreens.networkError'));
    } finally {
      setLoading(false);
    }
  }, [apiUrl, secretKey, t]);

  useEffect(() => {
    load();
  }, [load]);

  const hrefOf = useCallback(
    (behavior: AppBehavior) => buildAdminHref(behaviorScreen(behavior.behavior_code, isPro) ?? `/behaviors/${behavior.id}`),
    [isPro],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return behaviors;
    return behaviors.filter((b) => `${b.behavior_code} ${b.id}`.toLowerCase().includes(query));
  }, [behaviors, search]);

  // What Accounts offers but this app has not saved yet: no row, so it runs on defaults.
  const notConfigured = behaviorScreens(isPro).filter(([code]) => !behaviors.some((b) => b.behavior_code === code));
  const active = behaviors.filter((b) => b.is_active).length;

  if (loading) return <ScreenLoading />;
  if (loadError) return <ScreenLoadError message={loadError} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Heading level={2} visual="h5">{t('behaviors.list.statusTitle')}</Heading>
          <Text variant="body-sm" tone="muted" as="p">
            {t('behaviors.list.activeCount', { count: active, total: behaviors.length })}
          </Text>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)} leading={<Icon icon={Plus} size={16} />}>
          {t('behaviors.list.newBehavior')}
        </Button>
      </div>

      <AdminDataTable<AppBehavior>
        entity={t('sidebar.behaviors')}
        data={filtered}
        rowId={(behavior) => behavior.id}
        search={{ value: search, onChange: setSearch, placeholder: t('behaviors.list.searchPlaceholder') }}
        emptyState={{
          icon: Puzzle,
          title: search ? t('common.noResults') : t('behaviors.noBehaviors'),
          description: search ? t('behaviors.list.noMatches') : t('behaviors.noBehaviorsDesc'),
        }}
        columns={[
          {
            id: 'behavior',
            header: t('behaviors.list.columnBehavior'),
            primary: true,
            accessor: (behavior) => `${behavior.behavior_code} ${behavior.id}`,
            cell: (behavior) => (
              <Link href={hrefOf(behavior)} className="font-mono hover:underline">
                {behavior.behavior_code}
              </Link>
            ),
          },
          {
            id: 'status',
            header: t('behaviors.list.columnStatus'),
            cell: (behavior) => (
              <Badge variant="tonal" tone={behavior.is_active ? 'success' : 'neutral'}>
                {behavior.is_active ? t('common.active') : t('behaviors.inactive')}
              </Badge>
            ),
          },
          {
            id: 'updated',
            header: t('behaviors.list.columnUpdated'),
            type: 'date',
            accessor: (behavior) => timestampOf(behavior.updated_at),
            sortable: true,
          },
        ]}
      />

      {filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((behavior) => (
            <BehaviorCard key={behavior.id} behavior={behavior} config={configs[behavior.id]} href={hrefOf(behavior)} />
          ))}
        </div>
      )}

      {notConfigured.length > 0 && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <Text variant="body-sm" tone="muted" as="p">{t('behaviors.list.notConfigured')}</Text>
          <div className="flex flex-wrap gap-2">
            {notConfigured.map(([code, path]) => (
              <Link key={code} href={buildAdminHref(path)} className="font-mono text-body-sm hover:underline">
                {code}
              </Link>
            ))}
          </div>
        </div>
      )}

      <NewBehaviorDialog
        open={creating}
        onOpenChange={setCreating}
        secretKey={secretKey}
        appId={behaviors[0]?.app_id}
        existingCodes={behaviors.map((b) => b.behavior_code)}
        onCreated={load}
      />
    </div>
  );
}

export default function BehaviorsPage() {
  const { t } = useI18n();
  return (
    <SecurityScreen title={t('sidebar.behaviors')} description={t('behaviors.desc')}>
      {(secretKey) => <BehaviorsList key={secretKey} secretKey={secretKey} />}
    </SecurityScreen>
  );
}
