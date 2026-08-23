'use client';

import { useMemo, useState, useEffect, useCallback, Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Key,
  Shield,
  ShieldCheck,
  Pencil,
  SearchX,
  ArrowDownAZ,
  ArrowUpAZ,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
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
  Input,
  KeyValue,
  Spinner,
  Text,
  Tooltip,
  type DataTableColumn,
} from '@foundathyon/community-ui';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { BASE_PATH, cn } from '@/lib/utils';
import type { Role } from '@/lib/admin-types';
import { AdminDataTable } from '@/components/admin-data-table';

function truncateKey(key: string) {
  if (!key || key.length <= 20) return key;
  return key.slice(0, 12) + '••••••••••••' + key.slice(-8);
}

/** Debounce for the search box — §16 fixes it at 250 ms. */
const SEARCH_DEBOUNCE_MS = 250;

function RolesPageContent() {
  const { apiUrl, showNotification, savedSecretKey } = useAdmin();
  const { t } = useI18n();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Deep link from the command palette's "Acciones" group. Depending on the
  // VALUE (not on the searchParams object) keeps `router.replace` from
  // re-opening the dialog every time a filter is written back to the URL.
  const newParam = searchParams.get('new');
  useEffect(() => {
    if (newParam === '1') setIsRoleModalOpen(true);
  }, [newParam]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: '', description: '' });
  const [isRoleSubmitting, setIsRoleSubmitting] = useState(false);

  // §16 — the URL IS the state: a filtered view is shareable. The query string
  // seeds the filters once, and every change is written back with `replace`
  // (never `push`: filtering must not fill the history).
  const [searchInput, setSearchInput] = useState(() => searchParams.get('q') ?? '');
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>(() =>
    searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest'
  );

  // Reads the live query string so unrelated params (e.g. `new=1`) survive,
  // and never depends on the `searchParams` object — that would re-fire on
  // every replace.
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

  const toggleSort = () => {
    const next = sortBy === 'newest' ? 'oldest' : 'newest';
    setSortBy(next);
    writeUrl((params) => {
      if (next === 'oldest') params.set('sort', 'oldest');
      else params.delete('sort');
    });
  };

  // The search term is the only filter on this list — the newest/oldest toggle
  // orders, it does not filter — so "clear filters" clears exactly it.
  const clearFilters = () => {
    setSearchInput('');
    setSearchQuery('');
    writeUrl((params) => params.delete('q'));
  };

  const settingsHref = `${BASE_PATH}/settings`.replace(/\/+/g, '/') || '/settings';

  const fetchRoles = async () => {
    if (!savedSecretKey) return;
    try {
      const res = await fetch(apiUrl('/api/roles'), { headers: { 'X-Secret-API-Key': savedSecretKey } });
      const data = await res.json();
      if (data.data && (data.status === 200 || data.success)) {
        setRoles(data.data || []);
        setLoadError(false);
      } else {
        setLoadError(true);
        showNotification(data.error?.message || t('roles.errorLoadRoles'), 'error');
      }
    } catch {
      setLoadError(true);
      showNotification(t('common.errorConnection'), 'error');
    }
  };

  const handleSubmitRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRoleSubmitting(true);
    try {
      const method = isEditing ? 'PATCH' : 'POST';
      const url = isEditing ? apiUrl(`/api/roles/${selectedRole?.id}`) : apiUrl('/api/roles');
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Secret-API-Key': savedSecretKey },
        body: JSON.stringify(roleForm),
      });
      const data = await res.json();
      if (data.data || data.success) {
        showNotification(isEditing ? t('roles.roleUpdated') : t('roles.roleCreated'), 'success');
        setIsRoleModalOpen(false);
        setRoleForm({ name: '', description: '' });
        setSelectedRole(null);
        setIsEditing(false);
        fetchRoles();
      } else showNotification(data.error?.message || (isEditing ? t('roles.errorUpdateRole') : t('roles.errorCreateRole')), 'error');
    } catch {
      showNotification(t('settings.errorConnectionServer'), 'error');
    } finally {
      setIsRoleSubmitting(false);
    }
  };

  useEffect(() => {
    if (!savedSecretKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    fetch(apiUrl('/api/roles'), { headers: { 'X-Secret-API-Key': savedSecretKey } })
      .then((r) => r.json())
      .then((rData) => {
        if (rData.data && (rData.status === 200 || rData.success)) setRoles(rData.data || []);
        else setLoadError(true);
      })
      .catch(() => { setLoadError(true); })
      .finally(() => setLoading(false));
  }, [savedSecretKey]);

  // Search is delegated to the DataTable global filter; only the toolbar
  // "newest / oldest" toggle stays here — it is not a column-header sort.
  const sortedRoles = [...roles].sort((a, b) => {
    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();
    return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
  });

  const roleColumns = useMemo<DataTableColumn<Role>[]>(
    () => [
      {
        id: 'name',
        header: t('roles.name'),
        accessor: (role) => role.name,
        type: 'text',
        primary: true,
      },
      {
        id: 'description',
        header: t('roles.description'),
        accessor: (role) => role.description,
        type: 'text',
      },
      {
        // Comparable figure -> `number` cell, which brings `tabular-nums` (§14).
        id: 'users',
        header: t('roles.usersCount'),
        accessor: (role) => role.users_count ?? 0,
        type: 'number',
      },
      {
        // Custom cell: the `text` type would drop the mono treatment.
        id: 'appId',
        header: t('roles.appId'),
        cell: (role) => (
          <span
            className="block max-w-[200px] truncate font-mono text-code text-text-muted-foreground"
            title={role.app_id}
          >
            {role.app_id}
          </span>
        ),
      },
      {
        // No accessor on purpose: it keeps the raw ISO date out of the global
        // filter. `type: 'date'` is not used because it hard-codes the `es`
        // date-fns locale and this admin is bilingual.
        id: 'created',
        header: t('roles.created'),
        align: 'right',
        cell: (role) => (
          <span className="tabular-nums text-caption text-text-muted-foreground">
            {role.created_at ? new Date(role.created_at).toLocaleDateString() : '\u2014'}
          </span>
        ),
      },
      {
        // Never rendered (hidden by default) but still fed to the global
        // filter, so "search by ID" keeps working as the placeholder promises.
        id: 'id',
        header: 'ID',
        accessor: (role) => role.id,
      },
    ],
    [t]
  );

  // Mirrors DataTable's own global-filter rule (any column accessor contains
  // the query, case-insensitive) so the header count matches the rows shown.
  const shownCount = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return roles.length;
    return roles.filter((role) =>
      roleColumns.some((col) => {
        const value = col.accessor?.(role);
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(query);
      })
    ).length;
  }, [roles, roleColumns, searchQuery]);

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <Heading level={1}>{t('sidebar.roles')}</Heading>
            {/* §30 — subtitle carries the count that matters. */}
            {savedSecretKey && !loading && !loadError && (
              <Text tone="secondary" className="mt-1" tabular>
                {shownCount === roles.length
                  ? `${roles.length} ${t('sidebar.roles')}`
                  : t('common.countOf', { shown: shownCount, total: roles.length, entity: t('sidebar.roles') })}
              </Text>
            )}
            <Text variant="caption" tone="muted" className="mt-1 block">{t('roles.manageDesc')}</Text>
          </div>
          {!savedSecretKey ? (
            <Link
              href={settingsHref}
              className={cn(
                buttonVariants({ variant: 'secondary', size: 'lg' }),
                'gap-2 border-amber-500/20 text-amber-500 hover:bg-amber-500/10'
              )}
            >
              <Icon icon={Key} size={16} /> {t('roles.configSecretKey')}
            </Link>
          ) : (
            <Tooltip content={t('tooltips.newRole')}>
              <Button
                variant="primary"
                size="lg"
                onClick={() => setIsRoleModalOpen(true)}
                leading={<Icon icon={Shield} size={16} />}
              >
                {t('roles.newRole')}
              </Button>
            </Tooltip>
          )}
        </div>

        {!savedSecretKey ? (
          <Card className="border-amber-500/20">
            <EmptyState
              icon={Key}
              title={<span className="text-amber-300">{t('roles.secretKeyRequiredCard')}</span>}
              description={t('roles.secretKeyRequiredDesc')}
              action={
                <Link href={settingsHref} className={cn(buttonVariants({ variant: 'primary', size: 'lg' }))}>
                  {t('users.goToSettings')}
                </Link>
              }
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {/* §14 — one frame: toolbar (search · Columnas · order toggle), the
                table, and the footer with the count and the key in use. */}
            <AdminDataTable<Role>
              entity={t('sidebar.roles')}
              columns={roleColumns}
              data={sortedRoles}
              rowId={(role) => role.id}
              columnVisibility={{ defaultState: { id: false } }}
              globalFilter={searchQuery}
              pageSize={20}
              search={{
                value: searchInput,
                onChange: setSearchInput,
                placeholder: t('roles.searchPlaceholder') || 'Search by name, description or ID...',
              }}
              columnsButton
              toolbarEnd={
                <Tooltip content={t('tooltips.sortBy')}>
                  <Button
                    variant="ghost"
                    onClick={toggleSort}
                    leading={<Icon icon={sortBy === 'newest' ? ArrowDownAZ : ArrowUpAZ} size={14} />}
                  >
                    {sortBy === 'newest' ? t('users.sortByNewest') || 'Newest first' : t('users.sortByOldest') || 'Oldest first'}
                  </Button>
                </Tooltip>
              }
              onRowClick={(role) => setSelectedRole(role)}
              loading={loading}
              loadingRowCount={5}
              error={loadError ? { title: t('roles.errorLoadRoles'), retry: { label: t('common.retry'), onClick: () => { void fetchRoles(); } } } : undefined}
              emptyState={{
                icon: Shield,
                title: t('roles.noRoles'),
                description: t('roles.noRolesHint'),
                action: (
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => setIsRoleModalOpen(true)}
                    leading={<Icon icon={Shield} size={16} />}
                  >
                    {t('roles.newRole')}
                  </Button>
                ),
              }}
              noResultsState={{
                // §16 — «Sin resultados» is not an empty state: it offers to
                // clear the filters, and clears every one of them.
                icon: SearchX,
                title: t('common.noResults'),
                description: t('common.noResultsDesc'),
                action: (
                  <Button variant="secondary" size="lg" onClick={clearFilters}>
                    {t('common.clearFilters')}
                  </Button>
                ),
              }}
              footer={
                <span className="inline-flex items-center gap-1.5">
                  <Icon icon={ShieldCheck} size={12} />
                  {t('roles.consultingWith')}
                  <code className="font-mono">{truncateKey(savedSecretKey ?? '')}</code>
                </span>
              }
            />
          </div>
        )}
      </motion.div>

      <Dialog open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen}>
        <DialogContent size="md" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon icon={Shield} size={20} className="text-accent" />
              {isEditing ? t('roles.editRole') : t('roles.newRole')}
            </DialogTitle>
            <DialogDescription>{isEditing ? t('roles.editRoleDescription') : t('roles.roleDescription')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitRole} className="space-y-5">
            <FormField label={t('roles.name')} required>
              <Input required placeholder="admin" value={roleForm.name} onChange={(e) => setRoleForm((p) => ({ ...p, name: e.target.value }))} />
            </FormField>
            <FormField label={t('roles.description')}>
              <Input placeholder="Rol con permisos de administración" value={roleForm.description} onChange={(e) => setRoleForm((p) => ({ ...p, description: e.target.value }))} />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="secondary" size="lg" onClick={() => {
                setIsRoleModalOpen(false);
                setIsEditing(false);
                setSelectedRole(null);
                setRoleForm({ name: '', description: '' });
              }}>
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isRoleSubmitting}
                leading={isRoleSubmitting ? <Spinner size={16} label={null} /> : undefined}
              >
                {isRoleSubmitting ? (isEditing ? t('roles.updating') : t('roles.creating')) : (isEditing ? t('roles.updateRole') : t('roles.createRole'))}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedRole} onOpenChange={(open) => !open && setSelectedRole(null)}>
        <DialogContent size="lg" className="sm:max-w-2xl max-w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon icon={Shield} size={20} className="text-accent" />
              {t('roles.roleDetails')}
              {selectedRole && (
                <span className="text-secondary font-normal">({selectedRole.name})</span>
              )}
            </DialogTitle>
            <DialogDescription>
              {t('roles.roleInfo')}
            </DialogDescription>
          </DialogHeader>

          {selectedRole && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <KeyValue label="ID" mono className="col-span-2 break-all">
                  {selectedRole.id}
                </KeyValue>
                <KeyValue label={t('roles.name')} className="font-semibold">
                  {selectedRole.name}
                </KeyValue>
                <KeyValue label={t('roles.usersCount')}>{selectedRole.users_count ?? 0}</KeyValue>
                <KeyValue label={t('roles.appId')} mono className="break-all">
                  {selectedRole.app_id}
                </KeyValue>
                {selectedRole.description && (
                  <KeyValue label={t('roles.description')} className="col-span-2">
                    {selectedRole.description}
                  </KeyValue>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                <KeyValue label={t('roles.created')}>
                  {selectedRole.created_at ? new Date(selectedRole.created_at).toLocaleString() : '—'}
                </KeyValue>
                <KeyValue label={t('roles.updated')}>
                  {selectedRole.updated_at ? new Date(selectedRole.updated_at).toLocaleString() : '—'}
                </KeyValue>
              </div>

              <DialogFooter className="pt-4 gap-2">
                <Button variant="secondary" size="lg" leading={<Icon icon={Pencil} size={16} />} onClick={() => {
                  if (selectedRole) {
                    setIsEditing(true);
                    setRoleForm({ name: selectedRole.name, description: selectedRole.description || '' });
                    setIsRoleModalOpen(true);
                  }
                }}>
                  {t('common.edit')}
                </Button>
                <Button variant="secondary" size="lg" onClick={() => setSelectedRole(null)}>
                  {t('common.close')}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function RolesPageFallback() {
  const { t } = useI18n();
  return <Text tone="muted">{t('common.loading')}</Text>;
}

/** `useSearchParams` needs a Suspense boundary in a statically prerendered
 *  page — this route is one (§16 puts the filters in the URL). */
export default function RolesPage() {
  return (
    <Suspense fallback={<RolesPageFallback />}>
      <RolesPageContent />
    </Suspense>
  );
}
