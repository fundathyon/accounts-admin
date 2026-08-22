'use client';

import { useState, useEffect } from 'react';
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
  Filter,
  ArrowDownAZ,
  ArrowUpAZ,
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
  Select,
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
import type { App, APIKeyListItem } from '@/lib/admin-types';

function truncateKey(key: string) {
  if (!key || key.length <= 20) return key;
  return key.slice(0, 12) + '••••••••••••' + key.slice(-8);
}

export default function ApiKeysPage() {
  const { apiUrl, showNotification, savedSecretKey } = useAdmin();
  const { t } = useI18n();
  const [apps, setApps] = useState<App[]>([]);
  const [apiKeys, setApiKeys] = useState<APIKeyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [keysLoading, setKeysLoading] = useState(true);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
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
  const [searchQuery, setSearchQuery] = useState('');
  const [envFilter, setEnvFilter] = useState<'all' | 'production' | 'staging' | 'development'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');

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
    try {
      const res = await fetch(apiUrl('/api/api-keys'), {
        headers: { 'X-Secret-API-Key': savedSecretKey },
      });
      const data = await res.json();
      if (data.success) setApiKeys(data.data || []);
      else showNotification(data.error?.message || t('apiKeys.errorLoadKeys'), 'error');
    } catch {
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

  const filteredApiKeys = apiKeys.filter(key => {
    const query = searchQuery.toLowerCase();
    const searchMatch = key.name.toLowerCase().includes(query) ||
      (key.description && key.description.toLowerCase().includes(query)) ||
      key.publishable_key.toLowerCase().includes(query) ||
      key.id.toLowerCase().includes(query);

    if (!searchMatch) return false;

    if (envFilter !== 'all' && key.environment !== envFilter) return false;

    return true;
  }).sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
  });

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
            <Spinner size={20} label={t('common.loading')} className="text-text-muted" />
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
            {savedSecretKey && (
              <div className="px-6 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-2 text-xs text-emerald-400">
                <Icon icon={ShieldCheck} size={16} /> {t('apiKeys.consultingWith')} <span className="font-mono">{truncateKey(savedSecretKey)}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-2xl border border-border/50">
              <div className="flex-1 min-w-[300px]">
                <Input
                  size="lg"
                  leading={<Icon icon={Search} size={16} />}
                  placeholder={t('apiKeys.searchPlaceholder') || "Search by name, key or ID..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  wrapperClassName="border-none bg-background shadow-none"
                />
              </div>

              <Inline gap={3}>
                <Tooltip content={t('tooltips.state')}>
                  <div className="flex items-center gap-2">
                    <Icon icon={Filter} size={14} className="text-text-muted" />
                    <Select
                      size="lg"
                      value={envFilter}
                      onValueChange={(v) => setEnvFilter((v ?? 'all') as typeof envFilter)}
                      placeholder={t('apiKeys.environment') || "Env"}
                      className="w-[140px] border-none bg-background shadow-none"
                      items={[
                        { value: 'all', label: t('common.all') || "All Envs" },
                        { value: 'production', label: 'Production' },
                        { value: 'staging', label: 'Staging' },
                        { value: 'development', label: 'Development' },
                      ]}
                    />
                  </div>
                </Tooltip>

                <Tooltip content={t('tooltips.sortBy')}>
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={() => setSortBy(sortBy === 'newest' ? 'oldest' : 'newest')}
                    className="bg-background hover:bg-background/80"
                    leading={<Icon icon={sortBy === 'newest' ? ArrowDownAZ : ArrowUpAZ} size={16} />}
                  >
                    {sortBy === 'newest' ? t('users.sortByNewest') || "Newest" : t('users.sortByOldest') || "Oldest"}
                  </Button>
                </Tooltip>
              </Inline>
            </div>

            {keysLoading ? (
              <div className="py-12 flex justify-center">
                <Spinner size={20} label={t('common.loading')} className="text-text-muted" />
              </div>
            ) : apiKeys.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-8 py-4">{t('apiKeys.tableName')}</TableHead>
                    <TableHead className="px-8 py-4">{t('apiKeys.tableDescription')}</TableHead>
                    <TableHead className="px-8 py-4">{t('apiKeys.publishableKey')}</TableHead>
                    <TableHead className="px-8 py-4">{t('apiKeys.tableState')}</TableHead>
                    <TableHead className="px-8 py-4">{t('apiKeys.tableEnv')}</TableHead>
                    <TableHead className="px-8 py-4">{t('apiKeys.tableCreated')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApiKeys.map((k) => (
                    <TableRow
                      key={k.id}
                      interactive
                      className="group"
                      onClick={() => setSelectedApiKey(k)}
                    >
                      <TableCell className="px-8 py-4 font-medium">{k.name}</TableCell>
                      <TableCell className="px-8 py-4 text-text-secondary">{k.description || '—'}</TableCell>
                      <TableCell className="px-8 py-4 font-mono text-code text-text-muted max-w-[200px] truncate" title={k.publishable_key}>
                        {k.publishable_key}
                      </TableCell>
                      <TableCell className="px-8 py-4">
                        <Badge
                          variant={k.is_active ? 'tonal' : 'outline'}
                          tone={k.is_active ? 'success' : 'neutral'}
                        >
                          {k.is_active ? t('apiKeys.active') : t('apiKeys.inactive')}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-8 py-4 text-text-secondary capitalize">{k.environment}</TableCell>
                      <TableCell className="px-8 py-4 text-caption text-text-muted">
                        {k.created_at ? new Date(k.created_at).toLocaleDateString() : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}

            {apps.length > 0 && (
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
              <Text variant="body-sm" tone="secondary" className="block rounded-lg border border-border bg-muted/20 px-3 py-2">
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
                <span className="text-text-secondary font-normal">({selectedApiKey.name})</span>
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
                  <Text variant="code" as="p" className="break-all bg-muted/50 rounded-lg p-3 flex-1 min-w-0">
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
