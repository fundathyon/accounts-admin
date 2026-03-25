'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Key,
  Plus,
  Loader2,
  Copy,
  AlertCircle,
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
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { BASE_PATH } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
            <h1 className="text-3xl font-bold">{t('apiKeys.title')}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t('apiKeys.subtitle')}
            </p>
          </div>
          {!savedSecretKey ? (
            <Button variant="outline" asChild className="gap-2 border-amber-500/20 text-amber-500 hover:bg-amber-500/10">
              <Link href={settingsHref}>
                <Key className="w-4 h-4" /> {t('apiKeys.configSecretKey')}
              </Link>
            </Button>
          ) : (
            <Button onClick={() => setIsGenerateModalOpen(true)} className="gap-2" disabled={loading}>
              <Plus className="w-4 h-4" /> Generar API Keys
            </Button>
          )}
        </div>

        {!savedSecretKey ? (
          <Card className="border-amber-500/20 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <Key className="w-8 h-8 text-amber-400" />
            </div>
            <CardTitle className="text-amber-300 mb-2">{t('apiKeys.secretKeyRequired')}</CardTitle>
            <CardDescription className="mb-6">
              {t('apiKeys.configSecretKeyCard')}
            </CardDescription>
            <Button asChild>
              <Link href={settingsHref}>{t('apiKeys.goToSettings')}</Link>
            </Button>
          </Card>
        ) : loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
          </div>
        ) : apps.length === 0 && apiKeys.length === 0 ? (
          <Card className="border-dashed p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Layers className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="mb-2">{t('apiKeys.noApps')}</CardTitle>
            <CardDescription className="mb-6">
              {t('apiKeys.noAppsDesc')}
            </CardDescription>
            <Button asChild>
              <Link href={BASE_PATH ? `${BASE_PATH}`.replace(/\/+/g, '/') : '/'}>{t('apiKeys.goToDashboard')}</Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {savedSecretKey && (
              <div className="px-6 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-2 text-xs text-emerald-400">
                <ShieldCheck className="w-4 h-4" /> {t('apiKeys.consultingWith')} <span className="font-mono">{truncateKey(savedSecretKey)}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-2xl border border-border/50">
              <div className="relative flex-1 min-w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('apiKeys.searchPlaceholder') || "Search by name, key or ID..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 border-none bg-background shadow-none focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </div>

              <div className="flex items-center gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Select value={envFilter} onValueChange={(v: any) => setEnvFilter(v)}>
                      <SelectTrigger className="w-[140px] h-10 border-none bg-background shadow-none focus:ring-1 focus:ring-primary/30">
                        <div className="flex items-center gap-2">
                          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                          <SelectValue placeholder={t('apiKeys.environment') || "Env"} />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('common.all') || "All Envs"}</SelectItem>
                        <SelectItem value="production">Production</SelectItem>
                        <SelectItem value="staging">Staging</SelectItem>
                        <SelectItem value="development">Development</SelectItem>
                      </SelectContent>
                    </Select>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('tooltips.state')}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSortBy(sortBy === 'newest' ? 'oldest' : 'newest')}
                      className="h-10 gap-2 text-xs font-medium text-muted-foreground hover:text-foreground px-3 bg-background hover:bg-background/80"
                    >
                      {sortBy === 'newest' ? <ArrowDownAZ className="w-4 h-4" /> : <ArrowUpAZ className="w-4 h-4" />}
                      {sortBy === 'newest' ? t('users.sortByNewest') || "Newest" : t('users.sortByOldest') || "Oldest"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('tooltips.sortBy')}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {keysLoading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : apiKeys.length > 0 ? (
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b">
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
                          className="group cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => setSelectedApiKey(k)}
                        >
                          <TableCell className="px-8 py-4 font-medium">{k.name}</TableCell>
                          <TableCell className="px-8 py-4 text-muted-foreground">{k.description || '—'}</TableCell>
                          <TableCell className="px-8 py-4 text-xs font-mono text-muted-foreground max-w-[200px] truncate" title={k.publishable_key}>
                            {k.publishable_key}
                          </TableCell>
                          <TableCell className="px-8 py-4">
                            <Badge variant={k.is_active ? 'secondary' : 'outline'} className={k.is_active ? 'bg-emerald-500/10 text-emerald-400 border-0' : ''}>
                              {k.is_active ? t('apiKeys.active') : t('apiKeys.inactive')}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-8 py-4 text-muted-foreground capitalize">{k.environment}</TableCell>
                          <TableCell className="px-8 py-4 text-xs text-muted-foreground">
                            {k.created_at ? new Date(k.created_at).toLocaleDateString() : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : null}

            {apps.length > 0 && (
              <Card className="p-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Key className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg mb-2">{t('apiKeys.generateNew')}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t('apiKeys.generateNewDesc')}
                    </p>
                    <Button onClick={() => setIsGenerateModalOpen(true)} className="gap-2">
                      <Plus className="w-4 h-4" /> {t('apiKeys.generateKeys')}
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
      </motion.div>

      <Dialog open={isGenerateModalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
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
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {t('apiKeys.secretKeyWarning')}
              </div>
              {generatedKeys.publishable_key && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">{t('apiKeys.publishableKey')}</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={generatedKeys.publishable_key}
                      className="font-mono text-xs overflow-x-auto min-w-0"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedKeys!.publishable_key!);
                        showNotification(t('apiKeys.publishableCopied'), 'success');
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              {generatedKeys.secret_key && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">{t('apiKeys.secretKey')}</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={generatedKeys.secret_key}
                      className="font-mono text-xs overflow-x-auto min-w-0"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedKeys!.secret_key!);
                        showNotification(t('apiKeys.secretCopied'), 'success');
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button onClick={closeModal}>{t('apiKeys.close')}</Button>
                <Button variant="outline" onClick={() => { setGeneratedKeys(null); setFormData({ name: '', description: '' }); }}>
                  {t('apiKeys.generateAnother')}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleGenerate} className="space-y-4">
              <p className="text-sm text-muted-foreground rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                {t('apiKeys.generateUsesSecretApp') ||
                  'Las claves se crearán para la aplicación asociada a tu Secret Key guardada en ajustes.'}
              </p>
              <div className="space-y-2">
                <Label>{t('apiKeys.name')} *</Label>
                <Input
                  required
                  placeholder={t('apiKeys.namePlaceholder')}
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('apiKeys.description')}</Label>
                <Input
                  placeholder={t('apiKeys.descriptionPlaceholder')}
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              <DialogFooter className="gap-4 pt-4">
                <Button type="button" variant="outline" onClick={closeModal}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting} className="gap-2">
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? t('apiKeys.generating') : t('apiKeys.generate')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedApiKey} onOpenChange={(open) => !open && setSelectedApiKey(null)}>
        <DialogContent className="sm:max-w-2xl max-w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              {t('apiKeys.detailsTitle')}
              {selectedApiKey && (
                <span className="text-muted-foreground font-normal">({selectedApiKey.name})</span>
              )}
            </DialogTitle>
            <DialogDescription>
              {t('apiKeys.detailsDesc')}
            </DialogDescription>
          </DialogHeader>

          {selectedApiKey && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">{t('oauth.id')}</Label>
                  <p className="text-sm font-mono break-all">{selectedApiKey.id}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">{t('oauth.appId')}</Label>
                  <p className="text-sm font-mono break-all">{selectedApiKey.app_id}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">{t('apiKeys.tableName')}</Label>
                  <p className="text-sm font-semibold">{selectedApiKey.name}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">{t('apiKeys.tableState')}</Label>
                  <Badge variant={selectedApiKey.is_active ? 'secondary' : 'outline'} className={selectedApiKey.is_active ? 'bg-emerald-500/10 text-emerald-400 border-0' : ''}>
                    {selectedApiKey.is_active ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">{t('apiKeys.environment')}</Label>
                  <p className="text-sm capitalize">{selectedApiKey.environment}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">{t('apiKeys.keyId')}</Label>
                  <p className="text-sm font-mono">{selectedApiKey.key_id}</p>
                </div>
              </div>

              {selectedApiKey.description && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">{t('apiKeys.tableDescription')}</Label>
                  <p className="text-sm">{selectedApiKey.description}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">{t('apiKeys.publishableKey')}</Label>
                <div className="flex gap-2">
                  <p className="text-sm font-mono break-all bg-muted/50 rounded-lg p-3 flex-1 min-w-0">{selectedApiKey.publishable_key}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title={t('apiKeys.copy')}
                    onClick={() => {
                      navigator.clipboard.writeText(selectedApiKey.publishable_key);
                      showNotification('Publishable key copiada', 'success');
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground/80">
                {t('apiKeys.secretNotShown')}
              </p>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">{t('roles.created')}</Label>
                  <p className="text-sm">{selectedApiKey.created_at ? new Date(selectedApiKey.created_at).toLocaleString() : '—'}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">{t('roles.updated')}</Label>
                  <p className="text-sm">{selectedApiKey.updated_at ? new Date(selectedApiKey.updated_at).toLocaleString() : '—'}</p>
                </div>
                {selectedApiKey.last_used_at && (
                  <div className="space-y-2 col-span-2">
                    <Label className="text-muted-foreground text-xs">{t('apiKeys.lastUsed')}</Label>
                    <p className="text-sm">{new Date(selectedApiKey.last_used_at).toLocaleString()}</p>
                  </div>
                )}
                {selectedApiKey.revoked_at && (
                  <div className="space-y-2 col-span-2">
                    <Label className="text-muted-foreground text-xs">{t('apiKeys.revoked')}</Label>
                    <p className="text-sm text-amber-500">{new Date(selectedApiKey.revoked_at).toLocaleString()}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="pt-4 gap-2 flex-wrap">
                <div className="flex gap-2 ml-auto">
                  {selectedApiKey.is_active && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionLoading}
                      onClick={handleDeactivate}
                      className="gap-1.5 text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                    >
                      {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PowerOff className="w-3.5 h-3.5" />}
                      {t('apiKeys.deactivate')}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={actionLoading}
                    onClick={handleDelete}
                    className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    {t('apiKeys.delete')}
                  </Button>
                </div>
                <Button variant="outline" onClick={() => setSelectedApiKey(null)}>
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
