'use client';

import { useState, useEffect } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  Tooltip,
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
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
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
      if (data.data && (data.status === 200 || data.success)) setRoles(data.data || []);
      else showNotification(data.error?.message || t('roles.errorLoadRoles'), 'error');
    } catch {
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
    fetch(apiUrl('/api/roles'), { headers: { 'X-Secret-API-Key': savedSecretKey } })
      .then((r) => r.json())
      .then((rData) => {
        if (rData.data && (rData.status === 200 || rData.success)) setRoles(rData.data || []);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [savedSecretKey]);

  const filteredRoles = roles.filter(role => {
    const query = searchQuery.toLowerCase();
    return (
      role.name.toLowerCase().includes(query) ||
      (role.description && role.description.toLowerCase().includes(query)) ||
      role.id.toLowerCase().includes(query)
    );
  }).sort((a, b) => {
    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();
    return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
  });

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
          <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-muted/30 rounded-2xl border border-border/50">
            <div className="flex-1 min-w-[300px]">
              <Input
                size="lg"
                leading={<Icon icon={Search} size={16} />}
                placeholder={t('roles.searchPlaceholder') || "Search by name, description or ID..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                wrapperClassName="border-none bg-background shadow-none"
              />
            </div>

            <Inline gap={2} className="ml-auto">
              <Tooltip content={t('tooltips.sortBy')}>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => setSortBy(sortBy === 'newest' ? 'oldest' : 'newest')}
                  className="bg-background hover:bg-background/80"
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

            {loading ? (
              <div className="py-12 flex justify-center">
                <Spinner size={20} label={t('common.loading')} className="text-text-muted" />
              </div>
            ) : roles.length === 0 ? (
              <Card className="p-12 text-center">
                <Text tone="muted" className="py-12">{t('roles.noRolesHint')}</Text>
              </Card>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-8 py-4">{t('roles.name')}</TableHead>
                    <TableHead className="px-8 py-4">{t('roles.description')}</TableHead>
                    <TableHead className="px-8 py-4">{t('roles.usersCount')}</TableHead>
                    <TableHead className="px-8 py-4">{t('roles.appId')}</TableHead>
                    <TableHead className="px-8 py-4">{t('roles.created')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRoles.map((role) => (
                    <TableRow
                      key={role.id}
                      interactive
                      className="group"
                      onClick={() => setSelectedRole(role)}
                    >
                      <TableCell className="px-8 py-4 font-medium">{role.name}</TableCell>
                      <TableCell className="px-8 py-4 text-text-secondary">{role.description || '—'}</TableCell>
                      <TableCell className="px-8 py-4">{role.users_count ?? 0}</TableCell>
                      <TableCell className="px-8 py-4 font-mono text-code text-text-muted max-w-[200px] truncate" title={role.app_id}>
                        {role.app_id}
                      </TableCell>
                      <TableCell className="px-8 py-4 text-caption text-text-muted">
                        {role.created_at ? new Date(role.created_at).toLocaleDateString() : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
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
                <span className="text-text-secondary font-normal">({selectedRole.name})</span>
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
