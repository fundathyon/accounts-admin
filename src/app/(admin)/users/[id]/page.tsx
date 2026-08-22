'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Shield, Mail, CheckCircle2, XCircle, Loader2, Copy, Database, Pencil, Save, X } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Badge,
  Button,
  buttonVariants,
  Card,
  CardBody,
  Heading,
  Icon,
  IconButton,
  Inline,
  RoleBadge,
  Select,
  Separator,
  Stack,
  Text,
  Textarea,
} from '@foundathyon/community-ui';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { BASE_PATH } from '@/lib/utils';
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
        <Link
          href={usersHref}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'mb-6 -ml-2')}
        >
          <Icon icon={ChevronLeft} size={14} /> {t('userDetail.backToUsers')}
        </Link>
        <Card>
          <CardBody className="p-12 text-center">
            <Text tone="secondary">{t('userDetail.userNotFound')}</Text>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Link
        href={usersHref}
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'mb-6 -ml-2')}
      >
        <Icon icon={ChevronLeft} size={14} /> {t('userDetail.backToUsers')}
      </Link>
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <CardBody className="p-6">
            <Inline gap={6} align="start">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl shrink-0">
                {(user.name || user.user_name || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <Heading level={1} visual="h2">{user.name || user.user_name || t('userDetail.noName')}</Heading>
                <Text variant="body-sm" tone="secondary" as="p" className="font-mono mt-1">{user.id}</Text>
                {user.role_details && (
                  <RoleBadge role={user.role_details.name} className="mt-2" />
                )}
              </div>
            </Inline>
          </CardBody>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardBody className="p-6">
            <Heading level={2} visual="h4" className="mb-4 flex items-center gap-2">
              <Icon icon={Shield} size={14} /> {t('userDetail.generalInfo')}
            </Heading>
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
                      value={user.role_details?.name || null}
                      onValueChange={(v) => handleRoleChange(v ?? '')}
                      disabled={updatingRole}
                      placeholder={t('userDetail.selectRole') || 'Seleccionar rol'}
                      aria-label={t('userDetail.role') || 'Rol'}
                      items={roles.map((role) => ({ value: role.name, label: role.name }))}
                      className="w-[140px]"
                    />
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
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-6">
            <Inline justify="between" className="mb-4">
              <Heading level={2} visual="h4" className="flex items-center gap-2">
                <Icon icon={Database} size={14} /> {t('userDetail.metadata')}
              </Heading>
              {!editingMetadata ? (
                <Button variant="ghost" onClick={startEditMetadata} leading={<Icon icon={Pencil} size={14} />}>
                  {t('common.edit')}
                </Button>
              ) : (
                <Inline gap={2}>
                  <IconButton
                    icon={X}
                    label={t('common.cancel')}
                    variant="ghost"
                    onClick={() => setEditingMetadata(false)}
                  />
                  <Button
                    variant="primary"
                    onClick={handleSaveMetadata}
                    loading={savingMetadata}
                    leading={<Icon icon={Save} size={14} />}
                  >
                    {t('common.save')}
                  </Button>
                </Inline>
              )}
            </Inline>
            {editingMetadata ? (
              <Stack gap={2}>
                <Textarea
                  value={metadataInput}
                  onChange={(e) => { setMetadataInput(e.target.value); setMetadataError(''); }}
                  aria-label={t('userDetail.metadata')}
                  invalid={!!metadataError}
                  className="font-mono text-xs min-h-[180px] resize-y"
                  spellCheck={false}
                />
                {metadataError && (
                  <Text variant="caption" as="p" className="text-danger">{metadataError}</Text>
                )}
              </Stack>
            ) : user?.metadata && Object.keys(user.metadata).length > 0 ? (
              <pre className="text-xs font-mono bg-muted/40 rounded-lg p-3 overflow-x-auto text-sky-300 whitespace-pre-wrap break-all">
                {JSON.stringify(user.metadata, null, 2)}
              </pre>
            ) : (
              <Text tone="secondary">{t('userDetail.noMetadata')}</Text>
            )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-6">
            <Heading level={2} visual="h4" className="mb-4 flex items-center gap-2">
              <Icon icon={Mail} size={14} /> {t('userDetail.loginMethods')}
            </Heading>
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
                          <Badge variant="outline" tone="warning">
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
              <Text tone="secondary">{t('userDetail.noLoginMethods')}</Text>
            )}
            </CardBody>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
