'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Key,
  Plus,
  Copy,
  Layers,
  ShieldCheck,
  Trash2,
  PowerOff,
  Search,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Alert,
  Badge,
  Button,
  buttonVariants,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormField,
  Heading,
  Icon,
  IconButton,
  Inline,
  Input,
  KeyValue,
  Spinner,
  StatusBadge,
  Text,
} from '@foundathyon/community-ui';
import type { DataTableColumn, DataTableSort, StatusKey } from '@foundathyon/community-ui';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { BASE_PATH, cn } from '@/lib/utils';
import type { App, APIKeyListItem } from '@/lib/admin-types';
import { AdminDataTable, DeleteSelectionButton, DeleteSelectionDialog } from '@/components/admin-data-table';

function truncateKey(key: string) {
  if (!key || key.length <= 20) return key;
  return key.slice(0, 12) + '••••••••••••' + key.slice(-8);
}

/** Values the `env` URL param accepts; `all` is the default and is never written. */
const ENV_FILTERS = ['all', 'production', 'staging', 'development'] as const;
type EnvFilter = (typeof ENV_FILTERS)[number];

/**
 * Environment names are proper nouns of the platform, not product copy — the
 * Select rendered these exact literals before they were hoisted here so the
 * filter chip can reuse them.
 */
const ENV_LABELS: Record<Exclude<EnvFilter, 'all'>, string> = {
  production: 'Production',
  staging: 'Staging',
  development: 'Development',
};

function parseEnvFilter(value: string | null): EnvFilter {
  return ENV_FILTERS.includes(value as EnvFilter) ? (value as EnvFilter) : 'all';
}

/** §16 search debounce: 250 ms before the query reaches the table and the URL. */
const SEARCH_DEBOUNCE_MS = 250;

/**
 * Epoch value for the `date` cell. A number rather than the raw ISO string
 * keeps human-readable dates out of the global filter, and an unparseable or
 * missing date renders `—` instead of throwing inside `formatDate`.
 */
function timestampOf(value?: string | null) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** §19 state for a key: revoked and disabled are both terminal (0.6 opacity). */
function apiKeyStatus(key: APIKeyListItem): StatusKey {
  if (key.is_active) return 'active';
  return key.revoked_at ? 'revoked' : 'disabled';
}

export default function ApiKeysPage() {
  const { apiUrl, showNotification, savedSecretKey } = useAdmin();
  const { t } = useI18n();
  const [apps, setApps] = useState<App[]>([]);
  const [apiKeys, setApiKeys] = useState<APIKeyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [keysLoading, setKeysLoading] = useState(true);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Deep link from the command palette's "Acciones" group. Depending on the
  // VALUE (not on the searchParams object) keeps `router.replace` from
  // re-opening the dialog every time a filter is written back to the URL.
  const newParam = searchParams.get('new');
  useEffect(() => {
    if (newParam === '1') setIsGenerateModalOpen(true);
  }, [newParam]);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState<APIKeyListItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [generatedKeys, setGeneratedKeys] = useState<{
    publishable_key?: string;
    secret_key?: string;
    app_id?: string;
    created_at?: string;
  } | null>(null);
  // `searchInput` is what the field shows (always controlled, never remounted so
  // it keeps the caret and the focus when rows arrive); `searchQuery` is the
  // debounced value the table filters by and the URL carries.
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [envFilter, setEnvFilter] = useState<EnvFilter>('all');
  const [sort, setSort] = useState<DataTableSort | null>({ id: 'created', direction: 'desc' });
  const [keysError, setKeysError] = useState<string | null>(null);
  // Rows behind «Eliminar selección»; `null` keeps the confirmation closed.
  const [bulkTargets, setBulkTargets] = useState<APIKeyListItem[] | null>(null);

  // §16 — the URL IS the state: `?q=` + `?env=` make a filtered view shareable.
  // The query string seeds the filters once, and every change is written back
  // with `replace` (never `push`: filtering must not fill the history).
  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    setSearchInput(q);
    setSearchQuery(q);
    setEnvFilter(parseEnvFilter(searchParams.get('env')));
    // Mount-only on purpose: from here on the page writes the URL, not the
    // reverse. Seeding in an effect (rather than during render) also keeps the
    // controls out of any prerendered markup, so nothing can mismatch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reads the live query string so unrelated params (the palette's `new=1`)
  // survive, and never depends on the `searchParams` object — that would
  // re-fire on every replace.
  const writeUrl = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(window.location.search);
      mutate(params);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  // Debounced search: the input stays controlled by `searchInput` (it never
  // remounts, so focus and caret survive the results arriving), and only the
  // settled value reaches the table filter and the URL.
  useEffect(() => {
    if (searchInput === searchQuery) return;
    const id = setTimeout(() => {
      setSearchQuery(searchInput);
      writeUrl((params) => {
        if (searchInput.trim()) params.set('q', searchInput);
        else params.delete('q');
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput, searchQuery, writeUrl]);

  // Defaults are omitted from the URL so an unfiltered view keeps a clean one.
  const applyEnvFilter = (value: EnvFilter) => {
    setEnvFilter(value);
    writeUrl((params) => {
      if (value !== 'all') params.set('env', value);
      else params.delete('env');
    });
  };

  const settingsHref = `${BASE_PATH}/settings`.replace(/\/+/g, '/') || '/settings';

  const fetchApps = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/apps'));
      const data = await res.json();
      if (data.success) setApps(data.data || []);
      else showNotification(data.error?.message || t('apiKeys.errorLoadApps'), 'error');
    } catch {
      showNotification(t('apiKeys.errorConnectionApi'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAPIKeys = async () => {
    if (!savedSecretKey) {
      setKeysLoading(false);
      return;
    }
    setKeysLoading(true);
    setKeysError(null);
    try {
      const res = await fetch(apiUrl('/api/api-keys'), {
        headers: { 'X-Secret-API-Key': savedSecretKey },
      });
      const data = await res.json();
      if (data.success) setApiKeys(data.data || []);
      else {
        const message = data.error?.message || t('apiKeys.errorLoadKeys');
        setKeysError(message);
        showNotification(message, 'error');
      }
    } catch {
      setKeysError(t('apiKeys.errorConnectionApi'));
      showNotification(t('apiKeys.errorConnectionApi'), 'error');
    } finally {
      setKeysLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  useEffect(() => {
    fetchAPIKeys();
  }, [savedSecretKey]);

  // The environment picker is a faceted filter and `DataTable` only exposes a
  // single `globalFilter`, so it stays here and pre-filters the rows the table
  // receives. Search became `globalFilter`; the date order became the sortable
  // "Creado" column header.
  const envFilteredKeys = envFilter === 'all'
    ? apiKeys
    : apiKeys.filter((key) => key.environment === envFilter);


  // §16 — the one exit out of «Sin resultados»: it drops every applied filter,
  // the search term included.
  const clearAllFilters = () => {
    setSearchInput('');
    setSearchQuery('');
    setEnvFilter('all');
    writeUrl((params) => {
      params.delete('q');
      params.delete('env');
    });
  };

  // §16 — an applied filter is never hidden: the search keeps its value and the
  // facet button carries a counter. This only decides which empty copy the
  // table shows when the page-level environment facet leaves nothing.
  const filtersActive = searchQuery.trim() !== '' || envFilter !== 'all';

  // §16 — «Sin resultados» is not an empty state: it says nothing matched and
  // offers the way out, which clears every filter including the search term.
  const noResultsStateCopy = {
    icon: Search,
    title: t('common.noResults'),
    description: t('common.noResultsDesc'),
    action: (
      <Button variant="secondary" size="lg" onClick={clearAllFilters}>
        {t('common.clearFilters')}
      </Button>
    ),
  };

  // Shared copy for the two "no rows" states — the only existing page copy that
  // states there is nothing to show and offers the §11 exit.
  const noKeysStateCopy = {
    title: t('apiKeys.generateNew'),
    description: t('apiKeys.generateNewDesc'),
    action: (
      <Button
        variant="primary"
        size="lg"
        onClick={() => setIsGenerateModalOpen(true)}
        leading={<Icon icon={Plus} size={16} />}
      >
        {t('apiKeys.generateKeys')}
      </Button>
    ),
  };

  const keyColumns = useMemo<DataTableColumn<APIKeyListItem>[]>(() => [
    {
      id: 'name',
      header: t('apiKeys.tableName'),
      primary: true,
      // Doubles as the search corpus: the page's search also matched the id.
      accessor: (key) => `${key.name} ${key.id}`,
      cell: (key) => (
        <span className="block truncate font-medium" title={key.name}>{key.name}</span>
      ),
      sortable: true,
    },
    {
      id: 'description',
      header: t('apiKeys.tableDescription'),
      type: 'text',
      accessor: (key) => key.description,
    },
    {
      id: 'publishableKey',
      header: t('apiKeys.publishableKey'),
      type: 'digest',
      accessor: (key) => key.publishable_key,
    },
    {
      id: 'state',
      header: t('apiKeys.tableState'),
      // The `status` cell type renders the canonical English label and takes no
      // product copy, so the §19 badge is rendered here with the page's keys.
      cell: (key) => (
        <StatusBadge status={apiKeyStatus(key)}>
          {key.is_active ? t('apiKeys.active') : t('apiKeys.inactive')}
        </StatusBadge>
      ),
    },
    {
      id: 'environment',
      header: t('apiKeys.tableEnv'),
      cell: (key) => <span className="capitalize">{key.environment}</span>,
    },
    {
      id: 'created',
      header: t('apiKeys.tableCreated'),
      type: 'date',
      accessor: (key) => timestampOf(key.created_at),
      sortable: true,
    },
  ], [t]);

  // Mirrors DataTable's own `globalFilter` (it matches the query against every
  // column accessor) so the header count and the table always agree on what
  // "shown" means.
  const searchLower = searchQuery.trim().toLowerCase();
  const shownKeysCount = !searchLower
    ? envFilteredKeys.length
    : envFilteredKeys.filter((key) =>
      keyColumns.some((col) => {
        const value = col.accessor?.(key);
        return value !== null && value !== undefined && String(value).toLowerCase().includes(searchLower);
      })
    ).length;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!savedSecretKey) {
      showNotification(t('apiKeys.secretKeyRequired'), 'error');
      return;
    }
    if (!formData.name.trim()) {
      showNotification(t('apiKeys.nameRequired') || 'Name is required', 'error');
      return;
    }
    setIsSubmitting(true);
    setGeneratedKeys(null);
    try {
      const res = await fetch(apiUrl('/api/api-keys/generate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-API-Key': savedSecretKey,
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          ...(formData.description.trim() && { description: formData.description.trim() }),
        }),
      });
      const data = await res.json();
      const payload = data.data ?? data;
      if (res.ok && (data.success || payload?.publishable_key || payload?.secret_key)) {
        setGeneratedKeys({
          publishable_key: payload.publishable_key,
          secret_key: payload.secret_key,
          app_id: payload.app_id,
          created_at: payload.created_at,
        });
        fetchApps();
        fetchAPIKeys();
      } else {
        showNotification(data.error?.message || payload?.message || t('apiKeys.errorGenerate'), 'error');
      }
    } catch {
      showNotification(t('apiKeys.errorConnection'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selectedApiKey || !savedSecretKey) return;
    setActionLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/api-keys/${selectedApiKey.id}`), {
        method: 'PATCH',
        headers: {
          'X-Secret-API-Key': savedSecretKey,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (data.success || res.ok) {
        showNotification(t('apiKeys.deactivated'), 'success');
        setSelectedApiKey(null);
        fetchAPIKeys();
      } else {
        showNotification(data.error?.message || t('apiKeys.errorDeactivate'), 'error');
      }
    } catch {
      showNotification(t('apiKeys.errorConnection'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedApiKey || !savedSecretKey) return;
    if (!window.confirm(t('apiKeys.deleteConfirm', { name: selectedApiKey.name }))) return;
    setActionLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/api-keys/${selectedApiKey.id}`), {
        method: 'DELETE',
        headers: { 'X-Secret-API-Key': savedSecretKey },
      });
      const data = await res.json();
      if (data.success || res.ok) {
        showNotification(t('apiKeys.deleted'), 'success');
        setSelectedApiKey(null);
        fetchAPIKeys();
      } else {
        showNotification(data.error?.message || t('apiKeys.errorDelete'), 'error');
      }
    } catch {
      showNotification(t('apiKeys.errorConnection'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const closeModal = () => {
    setIsGenerateModalOpen(false);
    setFormData({ name: '', description: '' });
    setGeneratedKeys(null);
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <Heading level={1}>{t('apiKeys.title')}</Heading>
            <Text tone="secondary" className="mt-1">
              {t('apiKeys.subtitle')}
            </Text>
            {/* §30 — the header states the count that matters. */}
            {savedSecretKey && !keysLoading && apiKeys.length > 0 && (
              <Text variant="caption" tone="muted" as="span" className="mt-1 block">
                {t('common.countOf', { shown: shownKeysCount, total: apiKeys.length, entity: t('apiKeys.title') })}
              </Text>
            )}
          </div>
          {!savedSecretKey ? (
            <Link
              href={settingsHref}
              className={cn(
                buttonVariants({ variant: 'secondary', size: 'lg' }),
                'gap-2 border-amber-500/20 text-amber-500 hover:bg-amber-500/10'
              )}
            >
              <Icon icon={Key} size={16} /> {t('apiKeys.configSecretKey')}
            </Link>
          ) : (
            <Button
              variant="primary"
              size="lg"
              onClick={() => setIsGenerateModalOpen(true)}
              disabled={loading}
              leading={<Icon icon={Plus} size={16} />}
            >
              Generar API Keys
            </Button>
          )}
        </div>

        {!savedSecretKey ? (
          <Card className="border-amber-500/20">
            <EmptyState
              icon={Key}
              title={<span className="text-amber-300">{t('apiKeys.secretKeyRequired')}</span>}
              description={t('apiKeys.configSecretKeyCard')}
              action={
                <Link href={settingsHref} className={cn(buttonVariants({ variant: 'primary', size: 'lg' }))}>
                  {t('apiKeys.goToSettings')}
                </Link>
              }
            />
          </Card>
        ) : loading ? (
          <div className="py-20 flex justify-center">
            <Spinner size={20} label={t('common.loading')} className="text-muted-foreground" />
          </div>
        ) : apps.length === 0 && apiKeys.length === 0 ? (
          <Card className="border-dashed">
            <EmptyState
              icon={Layers}
              title={t('apiKeys.noApps')}
              description={t('apiKeys.noAppsDesc')}
              action={
                <Link
                  href={BASE_PATH ? `${BASE_PATH}`.replace(/\/+/g, '/') : '/'}
                  className={cn(buttonVariants({ variant: 'primary', size: 'lg' }))}
                >
                  {t('apiKeys.goToDashboard')}
                </Link>
              }
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {/* §14 — one frame: toolbar (search · Entorno · Columnas, and the
                selection summary with «Eliminar selección» on the right), the
                table, and the footer with the count and the key in use. */}
            <AdminDataTable<APIKeyListItem>
              entity={t('apiKeys.title')}
              columns={keyColumns}
              data={envFilteredKeys}
              rowId={(key) => key.id}
              loading={keysLoading}
              loadingRowCount={5}
              error={keysError ? { title: t('apiKeys.errorLoadKeys'), description: keysError, retry: { label: t('common.retry'), onClick: () => { void fetchAPIKeys(); } } } : undefined}
              // The table derives "no results" from `globalFilter` alone, so the
              // page-level environment facet decides the copy here: when it is
              // applied and nothing survives, the rows were filtered away — and
              // the exit is clearing the filters.
              emptyState={filtersActive ? noResultsStateCopy : { ...noKeysStateCopy, icon: Key }}
              noResultsState={noResultsStateCopy}
              globalFilter={searchQuery}
              pageSize={20}
              sorting={{ state: sort, onChange: setSort }}
              search={{
                value: searchInput,
                onChange: setSearchInput,
                placeholder: t('apiKeys.searchPlaceholder') || 'Search by name, key or ID...',
              }}
              filters={[
                {
                  id: 'env',
                  label: t('apiKeys.environment'),
                  multiple: false,
                  value: envFilter === 'all' ? [] : [envFilter],
                  onChange: (next) => applyEnvFilter(parseEnvFilter(next[0] ?? null)),
                  options: (Object.keys(ENV_LABELS) as Exclude<EnvFilter, 'all'>[]).map((env) => ({
                    value: env,
                    label: ENV_LABELS[env],
                    count: apiKeys.filter((key) => key.environment === env).length,
                  })),
                },
              ]}
              columnsButton
              selectable
              bulkActions={(rows) => <DeleteSelectionButton onClick={() => setBulkTargets(rows)} />}
              onRowClick={(key) => setSelectedApiKey(key)}
              // Revoked / deactivated keys are terminal rows (§14, §19).
              getRowProps={(key) => (key.is_active && !key.revoked_at ? undefined : { terminal: true })}
              footer={
                <span className="inline-flex items-center gap-1.5">
                  <Icon icon={ShieldCheck} size={12} />
                  {t('apiKeys.consultingWith')}
                  <code className="font-mono">{truncateKey(savedSecretKey ?? '')}</code>
                </span>
              }
            />

            {/* The table's empty / no-results state carries this exact headline
                and CTA, so the persistent card steps aside while the list is
                filtered — otherwise both render at once. */}
            {apps.length > 0 && envFilteredKeys.length > 0 && !filtersActive && (
              <Card className="p-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-accent-bg flex items-center justify-center shrink-0">
                    <Icon icon={Key} size={20} className="text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Heading level={3} className="mb-2">{t('apiKeys.generateNew')}</Heading>
                    <Text tone="secondary" className="mb-4">
                      {t('apiKeys.generateNewDesc')}
                    </Text>
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={() => setIsGenerateModalOpen(true)}
                      leading={<Icon icon={Plus} size={16} />}
                    >
                      {t('apiKeys.generateKeys')}
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
      </motion.div>

      {/* §17 — the confirmation behind «Eliminar selección»: names the count,
          the button says the verb, and every deletion resolves before it closes. */}
      <DeleteSelectionDialog<APIKeyListItem>
        targets={bulkTargets}
        onClose={() => setBulkTargets(null)}
        entity={t('apiKeys.title')}
        deleteOne={async (key) => {
          const res = await fetch(apiUrl(`/api/api-keys/${key.id}`), {
            method: 'DELETE',
            headers: { 'X-Secret-API-Key': savedSecretKey ?? '' },
          });
          const data = await res.json().catch(() => ({}));
          if (!(data.success || res.ok)) throw new Error(data.error?.message || `HTTP ${res.status}`);
        }}
        onFinished={async ({ done, failed }) => {
          if (failed.length === 0) {
            showNotification(t('common.deleteSelectedDone', { count: done, entity: t('apiKeys.title') }), 'success');
          } else {
            showNotification(
              t('common.deleteSelectedPartial', { done, total: done + failed.length, failed: failed.length }),
              'error'
            );
          }
          await fetchAPIKeys();
        }}
      />

      <Dialog open={isGenerateModalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon icon={Key} size={20} className="text-accent" />
              {generatedKeys ? t('apiKeys.keysGenerated') : t('apiKeys.generateModalTitle')}
            </DialogTitle>
            <DialogDescription>
              {generatedKeys
                ? t('apiKeys.keysSavedOnce')
                : t('apiKeys.generateDesc')}
            </DialogDescription>
          </DialogHeader>
          {generatedKeys ? (
            <div className="space-y-4">
              <Alert tone="warning" title={t('apiKeys.secretKeyWarning')} />
              {generatedKeys.publishable_key && (
                <FormField label={t('apiKeys.publishableKey')}>
                  <Inline gap={2}>
                    <Input
                      readOnly
                      value={generatedKeys.publishable_key}
                      className="font-mono text-code"
                      wrapperClassName="min-w-0 flex-1"
                    />
                    <IconButton
                      icon={Copy}
                      label={t('apiKeys.copy')}
                      variant="secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedKeys!.publishable_key!);
                        showNotification(t('apiKeys.publishableCopied'), 'success');
                      }}
                    />
                  </Inline>
                </FormField>
              )}
              {generatedKeys.secret_key && (
                <FormField label={t('apiKeys.secretKey')}>
                  <Inline gap={2}>
                    <Input
                      readOnly
                      value={generatedKeys.secret_key}
                      className="font-mono text-code"
                      wrapperClassName="min-w-0 flex-1"
                    />
                    <IconButton
                      icon={Copy}
                      label={t('apiKeys.copy')}
                      variant="secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedKeys!.secret_key!);
                        showNotification(t('apiKeys.secretCopied'), 'success');
                      }}
                    />
                  </Inline>
                </FormField>
              )}
              <DialogFooter>
                <Button variant="primary" size="lg" onClick={closeModal}>{t('apiKeys.close')}</Button>
                <Button variant="secondary" size="lg" onClick={() => { setGeneratedKeys(null); setFormData({ name: '', description: '' }); }}>
                  {t('apiKeys.generateAnother')}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleGenerate} className="space-y-4">
              <Text variant="body-sm" tone="secondary" className="block rounded-lg border border-border bg-subtle/20 px-3 py-2">
                {t('apiKeys.generateUsesSecretApp') ||
                  'Las claves se crearán para la aplicación asociada a tu Secret Key guardada en ajustes.'}
              </Text>
              <FormField label={t('apiKeys.name')} required>
                <Input
                  required
                  placeholder={t('apiKeys.namePlaceholder')}
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                />
              </FormField>
              <FormField label={t('apiKeys.description')}>
                <Input
                  placeholder={t('apiKeys.descriptionPlaceholder')}
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                />
              </FormField>
              <DialogFooter className="gap-4 pt-4">
                <Button type="button" variant="secondary" size="lg" onClick={closeModal}>
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={isSubmitting}
                  leading={isSubmitting ? <Spinner size={16} label={null} /> : undefined}
                >
                  {isSubmitting ? t('apiKeys.generating') : t('apiKeys.generate')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedApiKey} onOpenChange={(open) => !open && setSelectedApiKey(null)}>
        <DialogContent size="lg" className="sm:max-w-2xl max-w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon icon={Key} size={20} className="text-accent" />
              {t('apiKeys.detailsTitle')}
              {selectedApiKey && (
                <span className="text-secondary font-normal">({selectedApiKey.name})</span>
              )}
            </DialogTitle>
            <DialogDescription>
              {t('apiKeys.detailsDesc')}
            </DialogDescription>
          </DialogHeader>

          {selectedApiKey && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <KeyValue label={t('oauth.id')} mono className="break-all">
                  {selectedApiKey.id}
                </KeyValue>
                <KeyValue label={t('oauth.appId')} mono className="break-all">
                  {selectedApiKey.app_id}
                </KeyValue>
                <KeyValue label={t('apiKeys.tableName')} className="font-semibold">
                  {selectedApiKey.name}
                </KeyValue>
                <KeyValue label={t('apiKeys.tableState')}>
                  <Badge
                    variant={selectedApiKey.is_active ? 'tonal' : 'outline'}
                    tone={selectedApiKey.is_active ? 'success' : 'neutral'}
                  >
                    {selectedApiKey.is_active ? 'Activa' : 'Inactiva'}
                  </Badge>
                </KeyValue>
                <KeyValue label={t('apiKeys.environment')} className="capitalize">
                  {selectedApiKey.environment}
                </KeyValue>
                <KeyValue label={t('apiKeys.keyId')} mono>
                  {selectedApiKey.key_id}
                </KeyValue>
              </div>

              {selectedApiKey.description && (
                <KeyValue label={t('apiKeys.tableDescription')}>{selectedApiKey.description}</KeyValue>
              )}

              <div className="space-y-2">
                <Text variant="caption" tone="muted" className="block">{t('apiKeys.publishableKey')}</Text>
                <Inline gap={2} align="start">
                  <Text variant="code" as="p" className="break-all bg-subtle/50 rounded-lg p-3 flex-1 min-w-0">
                    {selectedApiKey.publishable_key}
                  </Text>
                  <IconButton
                    icon={Copy}
                    label={t('apiKeys.copy')}
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedApiKey.publishable_key);
                      showNotification('Publishable key copiada', 'success');
                    }}
                  />
                </Inline>
              </div>

              <Text variant="caption" tone="muted" className="block">
                {t('apiKeys.secretNotShown')}
              </Text>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                <KeyValue label={t('roles.created')}>
                  {selectedApiKey.created_at ? new Date(selectedApiKey.created_at).toLocaleString() : '—'}
                </KeyValue>
                <KeyValue label={t('roles.updated')}>
                  {selectedApiKey.updated_at ? new Date(selectedApiKey.updated_at).toLocaleString() : '—'}
                </KeyValue>
                {selectedApiKey.last_used_at && (
                  <KeyValue label={t('apiKeys.lastUsed')} className="col-span-2">
                    {new Date(selectedApiKey.last_used_at).toLocaleString()}
                  </KeyValue>
                )}
                {selectedApiKey.revoked_at && (
                  <KeyValue label={t('apiKeys.revoked')} className="col-span-2 text-amber-500">
                    {new Date(selectedApiKey.revoked_at).toLocaleString()}
                  </KeyValue>
                )}
              </div>

              <DialogFooter className="pt-4 gap-2 flex-wrap">
                <div className="flex gap-2 ml-auto">
                  {selectedApiKey.is_active && (
                    <Button
                      variant="secondary"
                      size="md"
                      loading={actionLoading}
                      onClick={handleDeactivate}
                      className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                      leading={<Icon icon={PowerOff} size={14} />}
                    >
                      {t('apiKeys.deactivate')}
                    </Button>
                  )}
                  <Button
                    variant="destructive-subtle"
                    size="md"
                    loading={actionLoading}
                    onClick={handleDelete}
                    leading={<Icon icon={Trash2} size={14} />}
                  >
                    {t('apiKeys.delete')}
                  </Button>
                </div>
                <Button variant="secondary" size="lg" onClick={() => setSelectedApiKey(null)}>
                  {t('apiKeys.close')}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
