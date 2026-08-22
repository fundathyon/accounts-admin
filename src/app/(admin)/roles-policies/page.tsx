'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Key,
  Shield,
  ShieldCheck,
  Pencil,
  Search,
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
  Inline,
  Input,
  KeyValue,
  Spinner,
  Text,
  Tooltip,
  DataTable,
  type DataTableColumn,
} from '@foundathyon/community-ui';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { BASE_PATH, cn } from '@/lib/utils';
import type { Role } from '@/lib/admin-types';

function truncateKey(key: string) {
  if (!key || key.length <= 20) return key;
  return key.slice(0, 12) + '••••••••••••' + key.slice(-8);
}

export default function RolesPage() {
  const { apiUrl, showNotification, savedSecretKey } = useAdmin();
  const { t } = useI18n();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

  // Deep link from the command palette's "Acciones" group.
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get('new') === '1') setIsRoleModalOpen(true);
  }, [searchParams]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: '', description: '' });
  const [isRoleSubmitting, setIsRoleSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');

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
            className="block max-w-[200px] truncate font-mono text-code text-muted"
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
          <span className="tabular-nums text-caption text-muted">
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

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <Heading level={1}>{t('sidebar.roles')}</Heading>
            <Text tone="secondary" className="mt-1">{t('roles.manageDesc')}</Text>
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

        {savedSecretKey && (
          <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-subtle/30 rounded-2xl border border-border/50">
            <div className="flex-1 min-w-[300px]">
              <Input
                size="lg"
                leading={<Icon icon={Search} size={16} />}
                placeholder={t('roles.searchPlaceholder') || "Search by name, description or ID..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                wrapperClassName="border-none bg-bg shadow-none"
              />
            </div>

            <Inline gap={2} className="ml-auto">
              <Tooltip content={t('tooltips.sortBy')}>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => setSortBy(sortBy === 'newest' ? 'oldest' : 'newest')}
                  className="bg-bg hover:bg-bg/80"
                  leading={<Icon icon={sortBy === 'newest' ? ArrowDownAZ : ArrowUpAZ} size={16} />}
                >
                  {sortBy === 'newest' ? t('users.sortByNewest') || "Newest first" : t('users.sortByOldest') || "Oldest first"}
                </Button>
              </Tooltip>
            </Inline>
          </div>
        )}

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
            <div className="px-6 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-2 text-xs text-emerald-400">
              <Icon icon={ShieldCheck} size={16} /> {t('roles.consultingWith')} <span className="font-mono">{truncateKey(savedSecretKey)}</span>
            </div>

            <DataTable<Role>
              columns={roleColumns}
              data={sortedRoles}
              rowId={(role) => role.id}
              columnVisibility={{ defaultState: { id: false } }}
              globalFilter={searchQuery}
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
                title: t('roles.noRoles'),
                action: (
                  <Button variant="secondary" size="lg" onClick={() => setSearchQuery('')}>
                    {t('common.clearFilters')}
                  </Button>
                ),
              }}
              labels={{
                loading: t('common.loading'),
                of: (shown, total) => `${shown} / ${total}`,
              }}
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
