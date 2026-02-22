'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Key,
  Shield,
  ShieldCheck,
  Plus,
  Loader2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { BASE_PATH } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [roleForm, setRoleForm] = useState({ name: '', description: '' });
  const [isRoleSubmitting, setIsRoleSubmitting] = useState(false);

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

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRoleSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/roles'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Secret-API-Key': savedSecretKey },
        body: JSON.stringify(roleForm),
      });
      const data = await res.json();
      if (data.data || data.success) {
        showNotification(t('roles.roleCreated'), 'success');
        setIsRoleModalOpen(false);
        setRoleForm({ name: '', description: '' });
        fetchRoles();
      } else showNotification(data.error?.message || t('roles.errorCreateRole'), 'error');
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
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [savedSecretKey]);

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">{t('sidebar.roles')}</h1>
            <p className="text-muted-foreground text-sm mt-1">{t('roles.manageDesc')}</p>
          </div>
          {!savedSecretKey ? (
            <Button variant="outline" asChild className="gap-2 border-amber-500/20 text-amber-500 hover:bg-amber-500/10">
              <Link href={settingsHref}>
                <Key className="w-4 h-4" /> {t('roles.configSecretKey')}
              </Link>
            </Button>
          ) : (
            <Button onClick={() => setIsRoleModalOpen(true)} className="gap-2">
              <Shield className="w-4 h-4" /> {t('roles.newRole')}
            </Button>
          )}
        </div>

        {!savedSecretKey ? (
          <Card className="border-amber-500/20 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <Key className="w-8 h-8 text-amber-400" />
            </div>
            <CardTitle className="text-amber-300 mb-2">{t('roles.secretKeyRequiredCard')}</CardTitle>
            <CardDescription className="mb-6">{t('roles.secretKeyRequiredDesc')}</CardDescription>
            <Button asChild>
              <Link href={settingsHref}>{t('users.goToSettings')}</Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="px-6 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-2 text-xs text-emerald-400">
              <ShieldCheck className="w-4 h-4" /> {t('roles.consultingWith')} <span className="font-mono">{truncateKey(savedSecretKey)}</span>
            </div>

            {loading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : roles.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="py-12 text-center text-muted-foreground text-sm">{t('roles.noRolesHint')}</div>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b">
                        <TableHead className="px-8 py-4">{t('roles.name')}</TableHead>
                        <TableHead className="px-8 py-4">{t('roles.description')}</TableHead>
                        <TableHead className="px-8 py-4">{t('roles.usersCount')}</TableHead>
                        <TableHead className="px-8 py-4">{t('roles.appId')}</TableHead>
                        <TableHead className="px-8 py-4">{t('roles.created')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roles.map((role) => (
                        <TableRow
                          key={role.id}
                          className="group cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => setSelectedRole(role)}
                        >
                          <TableCell className="px-8 py-4 font-medium">{role.name}</TableCell>
                          <TableCell className="px-8 py-4 text-muted-foreground">{role.description || '—'}</TableCell>
                          <TableCell className="px-8 py-4">{role.users_count ?? 0}</TableCell>
                          <TableCell className="px-8 py-4 text-xs font-mono text-muted-foreground max-w-[200px] truncate" title={role.app_id}>
                            {role.app_id}
                          </TableCell>
                          <TableCell className="px-8 py-4 text-xs text-muted-foreground">
                            {role.created_at ? new Date(role.created_at).toLocaleDateString() : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </motion.div>

      <Dialog open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              {t('roles.newRole')}
            </DialogTitle>
            <DialogDescription>{t('roles.roleDescription')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateRole} className="space-y-5">
            <div className="space-y-2">
              <Label>{t('roles.name')} *</Label>
              <Input required placeholder="admin" value={roleForm.name} onChange={(e) => setRoleForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('roles.description')}</Label>
              <Input placeholder="Rol con permisos de administración" value={roleForm.description} onChange={(e) => setRoleForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsRoleModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isRoleSubmitting} className="gap-2">
                {isRoleSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isRoleSubmitting ? t('roles.creating') : t('roles.createRole')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedRole} onOpenChange={(open) => !open && setSelectedRole(null)}>
        <DialogContent className="sm:max-w-2xl max-w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              {t('roles.roleDetails')}
              {selectedRole && (
                <span className="text-muted-foreground font-normal">({selectedRole.name})</span>
              )}
            </DialogTitle>
            <DialogDescription>
              {t('roles.roleInfo')}
            </DialogDescription>
          </DialogHeader>

          {selectedRole && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label className="text-muted-foreground text-xs">ID</Label>
                  <p className="text-sm font-mono break-all">{selectedRole.id}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">{t('roles.name')}</Label>
                  <p className="text-sm font-semibold">{selectedRole.name}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">{t('roles.usersCount')}</Label>
                  <p className="text-sm">{selectedRole.users_count ?? 0}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">{t('roles.appId')}</Label>
                  <p className="text-sm font-mono break-all">{selectedRole.app_id}</p>
                </div>
                {selectedRole.description && (
                  <div className="space-y-2 col-span-2">
                    <Label className="text-muted-foreground text-xs">{t('roles.description')}</Label>
                    <p className="text-sm">{selectedRole.description}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">{t('roles.created')}</Label>
                  <p className="text-sm">{selectedRole.created_at ? new Date(selectedRole.created_at).toLocaleString() : '—'}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">{t('roles.updated')}</Label>
                  <p className="text-sm">{selectedRole.updated_at ? new Date(selectedRole.updated_at).toLocaleString() : '—'}</p>
                </div>
              </div>

              <DialogFooter className="pt-4">
                <Button variant="outline" onClick={() => setSelectedRole(null)}>
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
