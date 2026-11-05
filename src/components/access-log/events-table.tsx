'use client';

import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, Copy, LogIn } from 'lucide-react';
import { Tooltip, type DataTableColumn } from '@foundathyon/community-ui';
import { AdminDataTable } from '@/components/admin-data-table';
import { StatusBadge } from '@/components/fdn/badge';
import { Button, IconButton } from '@/components/fdn/button';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { countryFlag } from '@/lib/countries';
import {
  EVENT_TYPE_STATUS,
  LOGIN_EVENTS_PAGE_SIZE,
  eventCountryName,
  eventTypeLabel,
  eventTypeOptions,
  fetchLoginEvents,
  geoSourceOptions,
  methodLabel,
  methodOptions,
  placeLabel,
  type LoginEvent,
  type Range,
} from '@/lib/login-events';
import { buildAdminHref } from '@/lib/utils';
import { LoginEventDetailDialog } from './event-detail';
import { GeoSourceBadge } from './geo-source';

/** Each one empty means "all". */
export type EventFilters = {
  type: string;
  method: string;
  country: string;
  geoSource: string;
  userId: string;
};

export const DEFAULT_EVENT_FILTERS: EventFilters = { type: '', method: '', country: '', geoSource: '', userId: '' };

/** Same debounce as the source: the user id applies when typing stops. */
const USER_ID_DEBOUNCE_MS = 400;

function hasEventFilters(f: EventFilters): boolean {
  return Boolean(f.type || f.method || f.country || f.geoSource || f.userId);
}

/** A click inside the cell must not open the row's detail. */
function stop(e: SyntheticEvent) {
  e.stopPropagation();
}

/** Server-paginated sign-ins. The page owns the filters: the country table also sets one. */
export function LoginEventsPanel({
  secretKey,
  range,
  filters,
  onFiltersChange,
  countries,
  userEmails,
  onUnsupported,
  onRetry,
  reloadKey,
  geoSourceSupported,
}: {
  secretKey: string;
  range: Range;
  filters: EventFilters;
  onFiltersChange: (f: EventFilters) => void;
  /** Countries with sign-ins in the period (from the summary), for the filter. */
  countries: { code: string; name: string }[];
  /** id → email, once the users are loaded. */
  userEmails: Map<string, string>;
  onUnsupported: () => void;
  onRetry: () => void;
  /** Changes to fetch the current page again. */
  reloadKey: number;
  /** The summary brought `sources`: this Accounts reports the location source. */
  geoSourceSupported: boolean;
}) {
  const { apiUrl, showNotification } = useAdmin();
  const { t, locale } = useI18n();
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<LoginEvent[]>([]);
  const [total, setTotal] = useState(0);
  // Loading until the answer to the current request arrives.
  const requestKey = JSON.stringify([filters, page, range, reloadKey]);
  const [loadedKey, setLoadedKey] = useState('');
  const loading = loadedKey !== requestKey;
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<LoginEvent | null>(null);
  const [userDraft, setUserDraft] = useState(filters.userId);
  const [rowsHaveGeoSource, setRowsHaveGeoSource] = useState(false);

  // Any change of what is listed goes back to the first page.
  const scope = `${range.from}|${range.to}|${JSON.stringify(filters)}`;
  const [prevScope, setPrevScope] = useState(scope);
  if (scope !== prevScope) {
    setPrevScope(scope);
    setPage(1);
  }

  const [prevUserId, setPrevUserId] = useState(filters.userId);
  if (filters.userId !== prevUserId) {
    setPrevUserId(filters.userId);
    setUserDraft(filters.userId);
  }

  useEffect(() => {
    const value = userDraft.trim();
    if (value === filters.userId) return;
    const timer = setTimeout(() => onFiltersChange({ ...filters, userId: value }), USER_ID_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [userDraft, filters, onFiltersChange]);

  useEffect(() => {
    // Only the latest request counts: a stale answer never overwrites a newer one.
    let cancelled = false;
    fetchLoginEvents(apiUrl, secretKey, { ...filters, page, range }, t).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setRows(res.rows);
        setTotal(res.total);
        setError('');
        if (res.rows.some((r) => r.geo_source)) setRowsHaveGeoSource(true);
      } else {
        setRows([]);
        setTotal(0);
        if (res.unsupported) onUnsupported();
        else setError(res.message);
      }
      setLoadedKey(requestKey);
    });
    return () => {
      cancelled = true;
    };
  }, [apiUrl, filters, onUnsupported, page, range, requestKey, secretKey, t]);

  const copyIp = useCallback(
    async (ip: string) => {
      try {
        await navigator.clipboard.writeText(ip);
        showNotification(t('accessLog.table.ipCopied'), 'success');
      } catch {
        showNotification(t('accessLog.detail.copyFailed'), 'error');
      }
    },
    [showNotification, t],
  );

  const countryOptions = useMemo(() => {
    const items = countries.map((c) => ({
      value: c.code,
      label: `${countryFlag(c.code)} ${eventCountryName(c.code, c.name, locale, t)}`,
    }));
    if (filters.country && !countries.some((c) => c.code === filters.country)) {
      items.push({
        value: filters.country,
        label: `${countryFlag(filters.country)} ${eventCountryName(filters.country, '', locale, t)}`,
      });
    }
    return items;
  }, [countries, filters.country, locale, t]);

  const columns = useMemo<DataTableColumn<LoginEvent>[]>(
    () => [
      {
        id: 'created_at',
        header: t('accessLog.table.columns.date'),
        type: 'relative-date',
        primary: true,
        width: '140px',
        accessor: (e) => e.created_at,
      },
      {
        id: 'user',
        header: t('accessLog.table.columns.user'),
        accessor: (e) => e.user_id,
        cell: (e) => {
          if (!e.user_id) return <span className="text-text-muted">—</span>;
          const email = userEmails.get(e.user_id);
          return (
            <span className="flex min-w-0 flex-col" onClick={stop}>
              <Link
                href={buildAdminHref(`/users/${e.user_id}`)}
                className="truncate underline-offset-2 hover:underline"
                title={e.user_id}
              >
                {email || <span className="font-mono text-body-sm">{e.user_id}</span>}
              </Link>
              {email && <span className="truncate font-mono text-caption text-text-muted">{e.user_id}</span>}
            </span>
          );
        },
      },
      {
        id: 'type',
        header: t('accessLog.table.columns.result'),
        accessor: (e) => e.type,
        cell: (e) => <StatusBadge status={EVENT_TYPE_STATUS[e.type]}>{eventTypeLabel(t, e.type)}</StatusBadge>,
      },
      {
        id: 'method',
        header: t('accessLog.table.columns.method'),
        hideBelow: 'md',
        accessor: (e) => e.method,
        cell: (e) => <span className={e.method ? '' : 'text-text-muted'}>{methodLabel(t, e.method, e.provider)}</span>,
      },
      {
        id: 'place',
        header: t('accessLog.table.columns.place'),
        accessor: (e) => e.country_code,
        cell: (e) => {
          if (!e.country_code) return <span className="text-text-muted">—</span>;
          const place = placeLabel(e);
          return (
            <span className="flex min-w-0 flex-col">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate">
                  <span aria-hidden>{countryFlag(e.country_code)}</span>{' '}
                  {eventCountryName(e.country_code, e.country_name, locale, t)}
                </span>
                <GeoSourceBadge source={e.geo_source} />
              </span>
              {place && <span className="truncate text-caption text-text-muted">{place}</span>}
            </span>
          );
        },
      },
      {
        id: 'ip',
        header: t('accessLog.table.columns.ip'),
        hideBelow: 'sm',
        accessor: (e) => e.ip,
        cell: (e) =>
          e.ip ? (
            <span className="flex items-center gap-1" onClick={stop}>
              <span className="font-mono text-body-sm">{e.ip}</span>
              <IconButton
                icon={Copy}
                label={t('accessLog.table.copyIp', { ip: e.ip })}
                variant="ghost"
                size="xs"
                onClick={() => copyIp(e.ip)}
              />
            </span>
          ) : (
            <span className="text-text-muted">—</span>
          ),
      },
      {
        id: 'device',
        header: t('accessLog.table.columns.device'),
        hideBelow: 'lg',
        accessor: (e) => e.device_name || e.user_agent,
        cell: (e) => {
          const text = e.device_name || e.user_agent;
          if (!text) return <span className="text-text-muted">—</span>;
          return (
            <Tooltip content={e.user_agent || e.device_name}>
              <span className="block max-w-[220px] truncate text-body-sm">{text}</span>
            </Tooltip>
          );
        },
      },
    ],
    [copyIp, locale, t, userEmails],
  );

  const filtered = hasEventFilters(filters);
  const singleFilter = (id: keyof EventFilters) => ({
    value: filters[id] ? [filters[id]] : [],
    onChange: (next: string[]) => onFiltersChange({ ...filters, [id]: next[next.length - 1] ?? '' }),
    multiple: false,
  });
  const clearFilters = (
    <Button variant="secondary" onClick={() => onFiltersChange(DEFAULT_EVENT_FILTERS)}>
      {t('accessLog.table.clearFilters')}
    </Button>
  );
  // An older Accounts does not report the source: no filter it would ignore.
  const showGeoFilter = geoSourceSupported || rowsHaveGeoSource || Boolean(filters.geoSource);

  return (
    <>
      <AdminDataTable<LoginEvent>
        entity={t('accessLog.table.entity')}
        columns={columns}
        data={rows}
        rowId={(e) => e.id}
        loading={loading}
        loadingRowCount={5}
        error={
          error
            ? { title: t('accessLog.table.loadFailed'), description: error, retry: { label: t('common.retry'), onClick: onRetry } }
            : undefined
        }
        search={{ value: userDraft, onChange: setUserDraft, placeholder: t('accessLog.table.userId') }}
        filters={[
          { id: 'type', label: t('accessLog.table.columns.result'), options: eventTypeOptions(t), ...singleFilter('type') },
          { id: 'method', label: t('accessLog.table.columns.method'), options: methodOptions(t), ...singleFilter('method') },
          { id: 'country', label: t('accessLog.table.country'), options: countryOptions, ...singleFilter('country') },
          ...(showGeoFilter
            ? [{ id: 'geoSource', label: t('accessLog.table.geoSource'), options: geoSourceOptions(t), ...singleFilter('geoSource') }]
            : []),
        ]}
        toolbarEnd={filtered ? clearFilters : undefined}
        pagination={{ pageSize: LOGIN_EVENTS_PAGE_SIZE, page, onPageChange: setPage, total, manual: true }}
        onRowClick={setSelected}
        rowActions={(e) => [{ label: t('accessLog.table.viewDetail'), icon: ArrowRight, onSelect: () => setSelected(e) }]}
        emptyState={
          filtered
            ? {
                title: t('accessLog.table.emptyFilteredTitle'),
                description: t('accessLog.table.emptyFilteredDescription'),
                action: clearFilters,
              }
            : {
                icon: LogIn,
                title: t('accessLog.table.emptyTitle'),
                description: t('accessLog.table.emptyDescription'),
              }
        }
      />

      <LoginEventDetailDialog
        event={selected}
        userEmail={selected ? userEmails.get(selected.user_id) : undefined}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
