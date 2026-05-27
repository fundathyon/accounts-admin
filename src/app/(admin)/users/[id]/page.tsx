'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Shield, Mail, CheckCircle2, XCircle, Loader2, Copy, Database, Pencil, Save, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { BASE_PATH } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { OAuthProviderLogo } from '@/components/oauth-provider-logo';
import type { User, Role } from '@/lib/admin-types';

export default function UserDetailPage() {
  const params = useParams();
  const { apiUrl, savedSecretKey, showNotification } = useAdmin();
  const { t } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingRole, setUpdatingRole] = useState(false);
  const [editingMetadata, setEditingMetadata] = useState(false);
  const [metadataInput, setMetadataInput] = useState('');
  const [metadataError, setMetadataError] = useState('');
  const [savingMetadata, setSavingMetadata] = useState(false);

  const id = params.id as string;

  useEffect(() => {
    if (!savedSecretKey) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const [userRes, rolesRes] = await Promise.all([
          fetch(apiUrl(`/api/users/${id}`), { headers: { 'X-Secret-API-Key': savedSecretKey } }),
          fetch(apiUrl('/api/roles'), { headers: { 'X-Secret-API-Key': savedSecretKey } }),
        ]);
        const userData = await userRes.json();
        const rolesData = await rolesRes.json();
        if (userData.success && userData.data) {
          setUser(userData.data);
        } else {
          // fallback: scan list
          const listRes = await fetch(apiUrl('/api/users'), { headers: { 'X-Secret-API-Key': savedSecretKey } });
          const listData = await listRes.json();
          if (listData.data && (listData.status === 200 || listData.success)) {
            const users: User[] = listData.data || [];
            setUser(users.find((u) => u.id === id) || null);
          }
        }
        if (rolesData.success && rolesData.data) {
          const list = Array.isArray(rolesData.data) ? rolesData.data : (rolesData.data?.data || []);
          setRoles(list);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, savedSecretKey, apiUrl]);

  const usersHref = `${BASE_PATH}/users`.replace(/\/+/g, '/') || '/users';

  const startEditMetadata = () => {
    setMetadataInput(JSON.stringify(user?.metadata ?? {}, null, 2));
    setMetadataError('');
    setEditingMetadata(true);
  };

  const handleSaveMetadata = async () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(metadataInput);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object');
    } catch {
      setMetadataError(t('userDetail.metadataInvalidJson'));
      return;
    }
    setSavingMetadata(true);
    try {
      const res = await fetch(apiUrl(`/api/users/${id}/metadata`), {
        method: 'PATCH',
        headers: { 'X-Secret-API-Key': savedSecretKey!, 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: parsed }),
      });
      const data = await res.json();
      if (res.ok && (data.success !== false)) {
        setUser((prev) => prev ? { ...prev, metadata: parsed } : null);
        setEditingMetadata(false);
        showNotification(t('userDetail.metadataSaved'), 'success');
      } else {
        showNotification(data.error?.message || t('userDetail.metadataError'), 'error');
      }
    } catch {
      showNotification(t('userDetail.metadataError'), 'error');
    } finally {
      setSavingMetadata(false);
    }
  };

  const handleRoleChange = async (newRoleName: string) => {
    if (!user || newRoleName === (user.role_details?.name ?? '')) return;
    setUpdatingRole(true);
    try {
      const res = await fetch(apiUrl(`/api/users/${user.id}/role`), {
        method: 'PATCH',
        headers: {
          'X-Secret-API-Key': savedSecretKey!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRoleName }),
      });
      const data = await res.json();
      if (res.ok && (data.status === 200 || data.success !== false)) {
        setUser((prev) =>
          prev
            ? {
                ...prev,
                role_details: prev.role_details
                  ? { ...prev.role_details, name: newRoleName }
                  : { id: '', name: newRoleName, description: '' },
              }
            : null
        );
        showNotification(t('userDetail.roleUpdated') || 'Rol actualizado', 'success');
      } else {
        const errMsg = data?.error?.message || data?.errors?.[0]?.message || t('userDetail.errorUpdatingRole');
        showNotification(errMsg, 'error');
      }
    } catch {
      showNotification(t('userDetail.errorUpdatingRole') || 'Error al actualizar el rol', 'error');
    } finally {
      setUpdatingRole(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild className="mb-6 gap-2 -ml-2">
          <Link href={usersHref}>
            <ChevronLeft className="w-4 h-4" /> {t('userDetail.backToUsers')}
          </Link>
        </Button>
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">{t('userDetail.userNotFound')}</p>
        </Card>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Button variant="ghost" asChild className="mb-6 gap-2 -ml-2">
        <Link href={usersHref}>
          <ChevronLeft className="w-4 h-4" /> {t('userDetail.backToUsers')}
        </Link>
      </Button>
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <div className="p-6 flex items-start gap-6">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl shrink-0">
              {(user.name || user.user_name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold">{user.name || user.user_name || t('userDetail.noName')}</h1>
              <p className="text-muted-foreground font-mono text-sm mt-1">{user.id}</p>
              {user.role_details && (
                <Badge variant="secondary" className="mt-2">
                  {user.role_details.name}
                </Badge>
              )}
            </div>
          </div>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <CardTitle className="text-base mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4" /> {t('userDetail.generalInfo')}
            </CardTitle>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">User ID</dt>
                <dd className="font-mono text-xs truncate max-w-[200px]" title={user.id}>
                  {user.id}
                </dd>
              </div>
              <Separator />
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Nombre</dt>
                <dd>{user.name || '—'}</dd>
              </div>
              <Separator />
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t('userDetail.userName')}</dt>
                <dd>{user.user_name || '—'}</dd>
              </div>
              <Separator />
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">App ID</dt>
                <dd className="font-mono text-xs truncate max-w-[200px]" title={user.app_id}>
                  {user.app_id}
                </dd>
              </div>
              <Separator />
              <div className="flex justify-between gap-4 items-center">
                <dt className="text-muted-foreground">{t('userDetail.role') || 'Rol'}</dt>
                <dd className="flex items-center gap-2">
                  {updatingRole ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : roles.length > 0 ? (
                    <Select
                      value={user.role_details?.name ?? ''}
                      onValueChange={handleRoleChange}
                      disabled={updatingRole}
                    >
                      <SelectTrigger className="w-[140px] h-8">
                        <SelectValue placeholder={t('userDetail.selectRole') || 'Seleccionar rol'} />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.name}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span>{user.role_details?.name || '—'}</span>
                  )}
                </dd>
              </div>
              <Separator />
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Creado</dt>
                <dd>{new Date(user.created_at).toLocaleString('es')}</dd>
              </div>
              <Separator />
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Última actividad</dt>
                <dd>{new Date(user.updated_at).toLocaleString('es')}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="w-4 h-4" /> {t('userDetail.metadata')}
              </CardTitle>
              {!editingMetadata ? (
                <Button variant="ghost" size="sm" onClick={startEditMetadata} className="gap-1.5 h-8">
                  <Pencil className="w-3.5 h-3.5" />
                  {t('common.edit')}
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditingMetadata(false)} className="h-8 w-8 p-0">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" onClick={handleSaveMetadata} disabled={savingMetadata} className="gap-1.5 h-8">
                    {savingMetadata ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {t('common.save')}
                  </Button>
                </div>
              )}
            </div>
            {editingMetadata ? (
              <div className="space-y-2">
                <Textarea
                  value={metadataInput}
                  onChange={(e) => { setMetadataInput(e.target.value); setMetadataError(''); }}
                  className="font-mono text-xs min-h-[180px] resize-y"
                  spellCheck={false}
                />
                {metadataError && (
                  <p className="text-xs text-rose-400">{metadataError}</p>
                )}
              </div>
            ) : user?.metadata && Object.keys(user.metadata).length > 0 ? (
              <pre className="text-xs font-mono bg-muted/40 rounded-lg p-3 overflow-x-auto text-sky-300 whitespace-pre-wrap break-all">
                {JSON.stringify(user.metadata, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">{t('userDetail.noMetadata')}</p>
            )}
          </Card>

          <Card className="p-6">
            <CardTitle className="text-base mb-4 flex items-center gap-2">
              <Mail className="w-4 h-4" /> {t('userDetail.loginMethods')}
            </CardTitle>
            {user.login_methods && user.login_methods.length > 0 ? (
              <div className="space-y-4">
                {user.login_methods.map((lm) => {
                  const emailToCopy = lm.details?.email ?? null;
                  const handleCopy = async () => {
                    const text = emailToCopy || lm.entity_id;
                    try {
                      await navigator.clipboard.writeText(text);
                      showNotification(
                        emailToCopy ? (t('userDetail.emailCopied') || 'Email copiado') : (t('userDetail.copied') || 'Copiado'),
                        'success'
                      );
                    } catch {
                      showNotification(t('userDetail.copyFailed') || 'Error al copiar', 'error');
                    }
                  };
                  return (
                    <button
                      key={lm.id}
                      type="button"
                      onClick={handleCopy}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border border-border bg-muted/30 transition-colors hover:bg-muted/50',
                        emailToCopy && 'cursor-pointer'
                      )}
                      title={emailToCopy ? (t('userDetail.clickToCopyEmail') || 'Click para copiar email') : (t('userDetail.clickToCopy') || 'Click para copiar')}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {lm.entity_type === 'oauth' && lm.details?.platform ? (
                          <OAuthProviderLogo provider={lm.details.platform} size={24} className="rounded" />
                        ) : lm.entity_type === 'email' ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 shrink-0">
                            <img src="/email-svgrepo-com.svg" alt="Email" className="w-full h-full" />
                          </span>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-orange-500/40 text-orange-400"
                          >
                            {lm.entity_type}
                          </Badge>
                        )}
                        {lm.is_verify ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400" />
                        )}
                        {emailToCopy && <Copy className="w-3.5 h-3.5 text-muted-foreground ml-auto shrink-0" />}
                      </div>
                      <dl className="space-y-1 text-xs">
                        <div className="flex gap-2">
                          <dt className="text-muted-foreground shrink-0">ID:</dt>
                          <dd className="font-mono truncate">{lm.entity_id}</dd>
                        </div>
                        {lm.details?.email && (
                          <div className="flex gap-2">
                            <dt className="text-muted-foreground shrink-0">Email:</dt>
                            <dd className="truncate">{lm.details.email}</dd>
                          </div>
                        )}
                        {lm.details?.created_at && (
                          <div className="flex gap-2">
                            <dt className="text-muted-foreground shrink-0">Creado:</dt>
                            <dd>{new Date(lm.details.created_at).toLocaleString('es')}</dd>
                          </div>
                        )}
                      </dl>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('userDetail.noLoginMethods')}</p>
            )}
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
