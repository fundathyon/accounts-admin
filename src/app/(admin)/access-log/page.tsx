'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Globe2, RefreshCw } from 'lucide-react';
import {
  Heading,
  Icon,
  StatCard,
  Tab,
  Tabs,
  TabsList,
  Text,
  type DataTableColumn,
} from '@foundathyon/community-ui';
import { DEFAULT_EVENT_FILTERS, LoginEventsPanel, type EventFilters } from '@/components/access-log/events-table';
import { GeoSourceBreakdown } from '@/components/access-log/geo-source';
import { AdminDataTable } from '@/components/admin-data-table';
import { Button } from '@/components/fdn/button';
import { RichMessage } from '@/components/security-screen/rich-message';
import { ScreenLoadError, ScreenLoading, ScreenUnavailable } from '@/components/security-screen/screen-states';
import { SecurityScreen } from '@/components/security-screen/security-screen';
import { useAdmin } from '@/context/admin-context';
import { useEdition } from '@/context/edition-context';
import { useI18n } from '@/context/i18n-context';
import { countryFlag } from '@/lib/countries';
import {
  GEO_SOURCES,
  LOGIN_EVENTS_RETENTION_DAYS,
  PERIODS,
  eventCountryName,
  fetchLoginEventsSummary,
  formatCount,
  periodRange,
  type CountryStat,
  type LoginEventsSummary,
  type PeriodDays,
} from '@/lib/login-events';
import { buildAdminHref } from '@/lib/utils';

const COUNTRY_PAGE_SIZE = 10;

function parseGeoSource(v: string | null): string {
  return GEO_SOURCES.find((s) => s === v) ?? '';
}

function parsePeriod(v: string | null): PeriodDays {
  return PERIODS.find((days) => String(days) === v) ?? 30;
}

/** The email of a user, from the same list the Users screen reads. */
function emailOf(raw: Record<string, unknown>): string {
  const methods = Array.isArray(raw.login_methods) ? raw.login_methods : [];
  for (const m of methods) {
    const method = m as { entity_type?: string; details?: { email?: unknown } };
    if (method?.entity_type === 'email' && typeof method.details?.email === 'string') return method.details.email;
  }
  if (typeof raw.email === 'string') return raw.email;
  return typeof raw.user_name === 'string' && raw.user_name.includes('@') ? raw.user_name : '';
}

function AccessLogContent({ secretKey }: { secretKey: string }) {
  const { apiUrl } = useAdmin();
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [period, setPeriod] = useState<PeriodDays>(() => parsePeriod(searchParams.get('days')));
  // The range is fixed when the period is chosen (or on refresh), not on every render.
  const [range, setRange] = useState(() => periodRange(parsePeriod(searchParams.get('days'))));
  const [filters, setFilters] = useState<EventFilters>(() => ({
    ...DEFAULT_EVENT_FILTERS,
    type: searchParams.get('type') ?? '',
    method: searchParams.get('method') ?? '',
    country: (searchParams.get('country') ?? '').toUpperCase(),
    geoSource: parseGeoSource(searchParams.get('geo_source')),
    userId: searchParams.get('user_id') ?? '',
  }));
  const [summary, setSummary] = useState<LoginEventsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');
  const [unsupported, setUnsupported] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [userEmails, setUserEmails] = useState<Map<string, string>>(() => new Map());

  // §16: the filters live in the URL, so a view can be linked.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const set = (key: string, value: string) => (value ? params.set(key, value) : params.delete(key));
    set('days', period === 30 ? '' : String(period));
    set('type', filters.type);
    set('method', filters.method);
    set('country', filters.country);
    set('geo_source', filters.geoSource);
    set('user_id', filters.userId);
    const next = params.toString();
    if (next !== window.location.search.replace(/^\?/, '')) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }, [filters, pathname, period, router]);

  useEffect(() => {
    let cancelled = false;
    fetchLoginEventsSummary(apiUrl, secretKey, range, t).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setSummary(res.summary);
        setSummaryError('');
      } else if (res.unsupported) {
        setUnsupported(true);
      } else {
        setSummary(null);
        setSummaryError(res.message);
      }
      setSummaryLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [apiUrl, range, reloadKey, secretKey, t]);

  // Emails for the User column: one load of the whole list, not one per row.
  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl('/api/users'), { headers: { 'X-Secret-API-Key': secretKey }, cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { data?: Record<string, unknown>[] } | null) => {
        if (cancelled || !Array.isArray(json?.data)) return;
        const map = new Map<string, string>();
        for (const user of json.data) {
          const email = emailOf(user);
          if (typeof user.id === 'string' && email) map.set(user.id, email);
        }
        setUserEmails(map);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [apiUrl, secretKey]);

  const choosePeriod = (value: string) => {
    const days = parsePeriod(value);
    setPeriod(days);
    setRange(periodRange(days));
  };

  const refresh = () => {
    setSummaryError('');
    setRange(periodRange(period));
    setReloadKey((k) => k + 1);
  };

  const onUnsupported = useCallback(() => setUnsupported(true), []);

  const countryCodes = useMemo(
    () => (summary?.countries ?? []).map((c) => ({ code: c.country_code, name: c.country_name })),
    [summary],
  );

  const countryColumns = useMemo<DataTableColumn<CountryStat>[]>(
    () => [
      {
        id: 'country',
        header: t('accessLog.columns.country'),
        primary: true,
        accessor: (c) => eventCountryName(c.country_code, c.country_name, locale, t),
        cell: (c) => (
          <span className="flex items-center gap-2">
            <span aria-hidden>{countryFlag(c.country_code)}</span>
            <span className="truncate">{eventCountryName(c.country_code, c.country_name, locale, t)}</span>
          </span>
        ),
      },
      { id: 'logins', header: t('accessLog.columns.logins'), type: 'number', accessor: (c) => c.logins },
      { id: 'blocked', header: t('accessLog.columns.blocked'), type: 'number', accessor: (c) => c.blocked },
      { id: 'unique_ips', header: t('accessLog.columns.uniqueIps'), type: 'number', hideBelow: 'sm', accessor: (c) => c.unique_ips },
    ],
    [locale, t],
  );

  const sortedCountries = useMemo(
    () => [...(summary?.countries ?? [])].sort((a, b) => b.logins + b.blocked - (a.logins + a.blocked)),
    [summary],
  );

  if (unsupported) {
    return <ScreenUnavailable title={t('accessLog.unsupported.title')} body={t('accessLog.unsupported.body')} />;
  }
  if (summaryLoading && !summary && !summaryError) return <ScreenLoading />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={String(period)} onValueChange={(value) => choosePeriod(String(value))}>
          <TabsList aria-label={t('accessLog.period')}>
            {PERIODS.map((days) => (
              <Tab key={days} value={String(days)}>
                {t('accessLog.days', { count: days })}
              </Tab>
            ))}
          </TabsList>
        </Tabs>
        <Button variant="secondary" leading={<Icon icon={RefreshCw} size={14} />} onClick={refresh}>
          {t('accessLog.table.refresh')}
        </Button>
      </div>

      {summaryError ? (
        <ScreenLoadError message={summaryError} onRetry={refresh} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: t('accessLog.columns.logins'), value: summary?.logins },
              { label: t('accessLog.columns.blocked'), value: summary?.blocked },
              { label: t('accessLog.columns.uniqueIps'), value: summary?.unique_ips },
              { label: t('accessLog.stats.uniqueUsers'), value: summary?.unique_users },
            ].map((stat) => (
              <StatCard
                key={stat.label}
                label={stat.label}
                value={formatCount(stat.value ?? 0, locale)}
                context={t('accessLog.stats.lastDays', { count: period })}
              />
            ))}
          </div>
          {summary?.sources && <GeoSourceBreakdown sources={summary.sources} />}

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Heading level={2} visual="h3" className="flex items-center gap-2">
                <Icon icon={Globe2} size={16} className="text-text-muted" />
                {t('accessLog.byCountry.title')}
              </Heading>
              <Text variant="body-sm" tone="muted">{t('accessLog.byCountry.hint')}</Text>
            </div>
            <AdminDataTable<CountryStat>
              entity={t('accessLog.byCountry.entity')}
              columns={countryColumns}
              data={sortedCountries}
              rowId={(c) => c.country_code}
              pageSize={sortedCountries.length > COUNTRY_PAGE_SIZE ? COUNTRY_PAGE_SIZE : undefined}
              onRowClick={(c) => setFilters((f) => ({ ...f, country: c.country_code }))}
              emptyState={{
                icon: Globe2,
                title: t('accessLog.byCountry.emptyTitle'),
                description: t('accessLog.byCountry.emptyDescription'),
              }}
            />
          </section>
        </>
      )}

      <section className="space-y-3">
        <Heading level={2} visual="h3">{t('accessLog.title')}</Heading>
        <LoginEventsPanel
          secretKey={secretKey}
          range={range}
          filters={filters}
          onFiltersChange={setFilters}
          countries={countryCodes}
          userEmails={userEmails}
          onUnsupported={onUnsupported}
          onRetry={refresh}
          reloadKey={reloadKey}
          geoSourceSupported={Boolean(summary?.sources)}
        />
      </section>

      <footer className="space-y-1 border-t border-border pt-4">
        <Text variant="body-sm" tone="muted" as="p">
          {t('accessLog.footer.retention', { days: LOGIN_EVENTS_RETENTION_DAYS })}
        </Text>
        <Text variant="body-sm" tone="muted" as="p">
          <RichMessage
            text={t('accessLog.footer.credit')}
            link={(content) => (
              <a href="https://db-ip.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-text">
                {content}
              </a>
            )}
          />
        </Text>
      </footer>
    </div>
  );
}

export default function AccessLogPage() {
  const { t } = useI18n();
  const { isPro } = useEdition();
  // Regional blocking is Pro: in Community its name stays as plain text.
  const geoLink = (content: string) => (
    <Link href={buildAdminHref('/geo-access')} className="underline underline-offset-2 hover:text-text">
      {content}
    </Link>
  );
  return (
    <SecurityScreen
      title={t('accessLog.title')}
      description={<RichMessage text={t('accessLog.subtitle')} link={isPro ? geoLink : undefined} />}
    >
      {(secretKey) => (
        // `useSearchParams` needs a Suspense boundary: the filters live in the URL.
        <Suspense fallback={<ScreenLoading />}>
          <AccessLogContent key={secretKey} secretKey={secretKey} />
        </Suspense>
      )}
    </SecurityScreen>
  );
}
