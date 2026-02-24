'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LogIn, Plus, Loader2, Key, ChevronDown, ChevronUp, ShieldCheck, RefreshCw, Copy, Link2, Pencil, Trash2, Power, PowerOff, MoreVertical, Search, Filter, ArrowDownAZ, ArrowUpAZ } from 'lucide-react';
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
import { OAuthProviderLogo } from '@/components/oauth-provider-logo';
import type { OAuthConfig, Role } from '@/lib/admin-types';

function truncateKey(key: string) {
  if (!key || key.length <= 20) return key;
  return key.slice(0, 12) + '••••••••••••' + key.slice(-8);
}
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
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

const ALLOWED_PROVIDERS = [
  { value: 'google', label: 'Google' },
  { value: 'microsoft', label: 'Microsoft' },
  { value: 'apple', label: 'Apple' },
  { value: 'github', label: 'GitHub' },
] as const;

const OAUTH_PLATFORMS = [
  { value: 'web', label: 'Web' },
  { value: 'android', label: 'Android' },
  { value: 'ios', label: 'iOS' },
  { value: 'desktop', label: 'Desktop' },
] as const;

interface OAuthConfigForm {
  provider: string;
  name: string;
  client_id: string;
  client_secret: string;
  callback_key: string;
  callback_uri: string;
  scopes: string;
  enabled: boolean;
  redirect_uri_web: string;
  redirect_uri_android: string;
  redirect_uri_ios: string;
  redirect_uri_desktop: string;
}

const initialForm: OAuthConfigForm = {
  provider: '',
  name: '',
  client_id: '',
  client_secret: '',
  callback_key: '',
  callback_uri: '',
  scopes: 'email profile openid',
  enabled: true,
  redirect_uri_web: '',
  redirect_uri_android: '',
  redirect_uri_ios: '',
  redirect_uri_desktop: '',
};

export default function OAuthProvidersPage() {
  const { apiUrl, showNotification, savedSecretKey, savedPublishableKey } = useAdmin();
  const { t } = useI18n();
  const [providers, setProviders] = useState<OAuthConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<OAuthConfig | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<OAuthConfig | null>(null);
  const [formData, setFormData] = useState<OAuthConfigForm>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [copyJustClicked, setCopyJustClicked] = useState(false);
  const [linkDialogProvider, setLinkDialogProvider] = useState<OAuthConfig | null>(null);
  const [linkPlatform, setLinkPlatform] = useState<string>('web');
  const [linkRole, setLinkRole] = useState<string>('default');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkResult, setLinkResult] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');

  const settingsHref = `${BASE_PATH}/settings`.replace(/\/+/g, '/') || '/settings';

  const fetchProviders = async () => {
    if (!savedSecretKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/oauth-configs'), {
        headers: { 'X-Secret-API-Key': savedSecretKey },
      });
      const data = await res.json();
      if (data.success) setProviders(data.data || []);
      else showNotification(data.error?.message || t('oauth.errorLoad'), 'error');
    } catch {
      showNotification(t('oauth.errorConnection'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, [savedSecretKey]);

  const filteredProviders = providers.filter(p => {
    const query = searchQuery.toLowerCase();
    const searchMatch = (p.name || '').toLowerCase().includes(query) ||
      p.provider.toLowerCase().includes(query) ||
      p.client_id.toLowerCase().includes(query) ||
      p.id.toLowerCase().includes(query);

    if (!searchMatch) return false;

    if (statusFilter === 'enabled' && !p.enabled) return false;
    if (statusFilter === 'disabled' && p.enabled) return false;

    if (providerFilter !== 'all' && p.provider !== providerFilter) return false;

    return true;
  });

  const fetchRoles = async () => {
    if (!savedSecretKey) return;
    try {
      const res = await fetch(apiUrl('/api/roles'), { headers: { 'X-Secret-API-Key': savedSecretKey } });
      const data = await res.json();
      if (data.data && (data.status === 200 || data.success)) setRoles(data.data || []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    fetchRoles();
  }, [savedSecretKey]);

  const generateRandomCallbackKey = (): string => {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const array = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    }
    return Array.from(array, (b) => chars[b % chars.length]).join('');
  };

  useEffect(() => {
    if (!isModalOpen || !savedSecretKey || editingProvider) return;
    const autoGenerateCallback = async () => {
      try {
        const res = await fetch(apiUrl('/api/oauth-configs/callback-base'), {
          headers: { 'X-Secret-API-Key': savedSecretKey },
        });
        const data = await res.json();
        const baseUrl = data.data?.base_url || data.base_url;
        if (!baseUrl) return;
        const key = generateRandomCallbackKey();
        const callbackUri = `${baseUrl.replace(/\/$/, '')}/api/v1/oauth/${key}`;
        setFormData((p) => ({ ...p, callback_key: key, callback_uri: callbackUri }));
      } catch {
        showNotification(t('oauth.errorBaseUrl'), 'error');
      }
    };
    autoGenerateCallback();
  }, [isModalOpen, savedSecretKey, editingProvider, apiUrl, showNotification]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.provider || !formData.client_id?.trim() || !formData.client_secret?.trim() ||
      !formData.callback_key?.trim() || !formData.callback_uri?.trim() || !formData.redirect_uri_web?.trim()) {
      showNotification(t('oauth.completeFields'), 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        provider: formData.provider.trim(),
        name: formData.name.trim() || undefined,
        client_id: formData.client_id.trim(),
        client_secret: formData.client_secret.trim(),
        callback_key: formData.callback_key.trim(),
        callback_uri: formData.callback_uri.trim(),
        scopes: formData.scopes.trim() || undefined,
        enabled: formData.enabled,
        redirect_uri_web: formData.redirect_uri_web.trim(),
        redirect_uri_android: formData.redirect_uri_android.trim() || undefined,
        redirect_uri_ios: formData.redirect_uri_ios.trim() || undefined,
        redirect_uri_desktop: formData.redirect_uri_desktop.trim() || undefined,
      };
      const res = await fetch(apiUrl('/api/oauth-configs'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-API-Key': savedSecretKey,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success || res.ok) {
        showNotification(t('oauth.created'), 'success');
        closeModal();
        fetchProviders();
      } else {
        showNotification(data.error?.message || data.error?.Message || t('oauth.errorCreate'), 'error');
      }
    } catch {
      showNotification(t('oauth.errorConnectionServer'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProvider(null);
    setFormData(initialForm);
    setAdvancedOpen(false);
  };

  const openEditModal = (provider: OAuthConfig) => {
    setFormData({
      provider: provider.provider,
      name: provider.name ?? '',
      client_id: provider.client_id,
      client_secret: '',
      callback_key: provider.callback_key,
      callback_uri: provider.callback_uri,
      scopes: provider.scopes ?? 'email profile openid',
      enabled: provider.enabled,
      redirect_uri_web: provider.redirect_uri_web,
      redirect_uri_android: provider.redirect_uri_android ?? '',
      redirect_uri_ios: provider.redirect_uri_ios ?? '',
      redirect_uri_desktop: provider.redirect_uri_desktop ?? '',
    });
    setEditingProvider(provider);
    setSelectedProvider(null);
    setIsModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProvider) return;
    if (!formData.client_id?.trim() || !formData.callback_key?.trim() || !formData.callback_uri?.trim() || !formData.redirect_uri_web?.trim()) {
      showNotification(t('oauth.completeFields'), 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        provider: editingProvider.provider,
        name: formData.name.trim() || undefined,
        client_id: formData.client_id.trim(),
        callback_key: formData.callback_key.trim(),
        callback_uri: formData.callback_uri.trim(),
        scopes: formData.scopes.trim() || undefined,
        enabled: formData.enabled,
        redirect_uri_web: formData.redirect_uri_web.trim(),
        redirect_uri_android: formData.redirect_uri_android.trim() || undefined,
        redirect_uri_ios: formData.redirect_uri_ios.trim() || undefined,
        redirect_uri_desktop: formData.redirect_uri_desktop.trim() || undefined,
      };
      if (formData.client_secret.trim()) payload.client_secret = formData.client_secret.trim();
      const res = await fetch(apiUrl(`/api/oauth-configs/${encodeURIComponent(editingProvider.id)}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-API-Key': savedSecretKey!,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success || res.ok) {
        showNotification(t('oauth.updated'), 'success');
        closeModal();
        fetchProviders();
      } else {
        showNotification(data.error?.message || data.error?.Message || t('oauth.errorUpdate'), 'error');
      }
    } catch {
      showNotification(t('oauth.errorConnectionServer'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateCallback = async () => {
    try {
      const res = await fetch(apiUrl('/api/oauth-configs/callback-base'));
      const data = await res.json();
      const baseUrl = data.data?.base_url || data.base_url;
      if (!baseUrl) {
        showNotification(t('oauth.errorBaseUrlApi'), 'error');
        return;
      }
      const key = generateRandomCallbackKey();
      const callbackUri = `${baseUrl.replace(/\/$/, '')}/api/v1/oauth/${key}`;
      setFormData((p) => ({ ...p, callback_key: key, callback_uri: callbackUri }));
      showNotification(t('oauth.callbackGenerated'), 'success');
    } catch {
      showNotification(t('oauth.errorBaseUrl'), 'error');
    }
  };

  const handleOpenLinkDialog = (e: React.MouseEvent, provider: OAuthConfig) => {
    e.stopPropagation();
    setLinkDialogProvider(provider);
    setLinkPlatform('web');
    setLinkRole(roles.length > 0 ? roles[0].name : 'default');
    setLinkResult(null);
  };

  const handleFetchOAuthLink = async () => {
    if (!linkDialogProvider || !savedPublishableKey) return;
    setLinkLoading(true);
    setLinkResult(null);
    try {
      const url = apiUrl(`/api/oauths/link?provider=${encodeURIComponent(linkDialogProvider.provider)}&platform=${encodeURIComponent(linkPlatform)}&role=${encodeURIComponent(linkRole)}`);
      const res = await fetch(url, {
        headers: { 'X-Publishable-API-Key': savedPublishableKey },
      });
      const data = await res.json();
      if (data.success && data.data) {
        setLinkResult(data.data);
      } else {
        showNotification(data.error?.message || t('oauth.errorLink'), 'error');
      }
    } catch {
      showNotification(t('oauth.errorConnection'), 'error');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (linkResult) {
      navigator.clipboard.writeText(linkResult);
      showNotification(t('oauth.linkCopied'), 'success');
    }
  };

  const [actionLoading, setActionLoading] = useState<'delete' | 'disable' | 'enable' | null>(null);

  const handleDeleteProvider = async () => {
    if (!selectedProvider || !savedSecretKey) return;
    if (!window.confirm(t('oauth.deleteConfirm'))) return;
    setActionLoading('delete');
    try {
      const res = await fetch(apiUrl(`/api/oauth-configs/${encodeURIComponent(selectedProvider.id)}`), {
        method: 'DELETE',
        headers: { 'X-Secret-API-Key': savedSecretKey },
      });
      const data = await res.json();
      if (data.success || res.ok) {
        showNotification(t('oauth.deleted'), 'success');
        setSelectedProvider(null);
        fetchProviders();
      } else {
        showNotification(data.error?.message || data.error?.Message || t('oauth.errorDelete'), 'error');
      }
    } catch {
      showNotification(t('oauth.errorConnectionServer'), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisableProvider = async () => {
    if (!selectedProvider || !savedSecretKey) return;
    setActionLoading('disable');
    try {
      const res = await fetch(apiUrl(`/api/oauth-configs/${encodeURIComponent(selectedProvider.id)}/disable`), {
        method: 'POST',
        headers: { 'X-Secret-API-Key': savedSecretKey },
      });
      const data = await res.json();
      if (data.success || res.ok) {
        showNotification(t('oauth.disabledSuccess'), 'success');
        setSelectedProvider((prev) => (prev ? { ...prev, enabled: false } : null));
        fetchProviders();
      } else {
        showNotification(data.error?.message || data.error?.Message || t('oauth.errorDisable'), 'error');
      }
    } catch {
      showNotification(t('oauth.errorConnectionServer'), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEnableProvider = async () => {
    if (!selectedProvider || !savedSecretKey) return;
    setActionLoading('enable');
    try {
      const res = await fetch(apiUrl(`/api/oauth-configs/${encodeURIComponent(selectedProvider.id)}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-API-Key': savedSecretKey,
        },
        body: JSON.stringify({ enabled: true }),
      });
      const data = await res.json();
      if (data.success || res.ok) {
        showNotification(t('oauth.enabledSuccess'), 'success');
        setSelectedProvider((prev) => (prev ? { ...prev, enabled: true } : null));
        fetchProviders();
      } else {
        showNotification(data.error?.message || data.error?.Message || t('oauth.errorEnable'), 'error');
      }
    } catch {
      showNotification(t('oauth.errorConnectionServer'), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">{t('oauth.title')}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t('oauth.subtitle')}
            </p>
          </div>
          {!savedSecretKey ? (
            <Button variant="outline" asChild className="gap-2 border-amber-500/20 text-amber-500 hover:bg-amber-500/10">
              <Link href={settingsHref}>
                <Key className="w-4 h-4" /> {t('oauth.configSecretKey')}
              </Link>
            </Button>
          ) : (
            <Button onClick={() => setIsModalOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Nuevo Proveedor OAuth
            </Button>
          )}
        </div>

        {!savedSecretKey ? (
          <Card className="border-amber-500/20 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <Key className="w-8 h-8 text-amber-400" />
            </div>
            <CardTitle className="text-amber-300 mb-2">{t('oauth.secretKeyRequired')}</CardTitle>
            <CardDescription className="mb-6">
              {t('oauth.configSecretKeyCard')}
            </CardDescription>
            <Button asChild>
              <Link href={settingsHref}>{t('oauth.goToSettings')}</Link>
            </Button>
          </Card>
        ) : loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="px-6 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-2 text-xs text-emerald-400">
              <ShieldCheck className="w-4 h-4" /> {t('oauth.consultingWith')} <span className="font-mono">{truncateKey(savedSecretKey)}</span>
            </div>

            <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-2xl border border-border/50">
              <div className="relative flex-1 min-w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('oauth.searchPlaceholder') || "Search by name, provider or ID..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 border-none bg-background shadow-none focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </div>

              <div className="flex items-center gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Select value={providerFilter} onValueChange={(v) => setProviderFilter(v)}>
                      <SelectTrigger className="w-[140px] h-10 border-none bg-background shadow-none focus:ring-1 focus:ring-primary/30">
                        <div className="flex items-center gap-2">
                          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                          <SelectValue placeholder={t('oauth.provider') || "Provider"} />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('common.all') || "All"}</SelectItem>
                        {ALLOWED_PROVIDERS.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('tooltips.oauth')}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                      <SelectTrigger className="w-[140px] h-10 border-none bg-background shadow-none focus:ring-1 focus:ring-primary/30">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                          <SelectValue placeholder={t('users.state') || "State"} />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('common.all') || "Both"}</SelectItem>
                        <SelectItem value="enabled">{t('oauth.enabled') || "Enabled"}</SelectItem>
                        <SelectItem value="disabled">{t('oauth.disabled') || "Disabled"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('tooltips.state')}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {providers.length === 0 ? (
              <Card className="border-dashed p-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mx-auto mb-4">
                  <LogIn className="w-8 h-8 text-rose-400" />
                </div>
                <CardTitle className="mb-2">{t('oauth.noProviders')}</CardTitle>
                <CardDescription className="mb-6">
                  {t('oauth.noProvidersDesc')}
                </CardDescription>
                <Button onClick={() => setIsModalOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" /> {t('oauth.addProvider')}
                </Button>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b">
                        <TableHead className="px-8 py-4">{t('oauth.tableProvider')}</TableHead>
                        <TableHead className="px-8 py-4">{t('oauth.tableName')}</TableHead>
                        <TableHead className="px-8 py-4">{t('oauth.tableClientId')}</TableHead>
                        <TableHead className="px-8 py-4">{t('oauth.tableState')}</TableHead>
                        <TableHead className="px-8 py-4">{t('oauth.tableCallbackUri')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProviders.map((p) => (
                        <TableRow
                          key={p.id}
                          className="group cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => setSelectedProvider(p)}
                        >
                          <TableCell className="px-8 py-4">
                            <OAuthProviderLogo provider={p.provider} size={28} className="rounded" />
                          </TableCell>
                          <TableCell className="px-8 py-4 text-muted-foreground">{p.name || '—'}</TableCell>
                          <TableCell className="px-8 py-4 text-xs font-mono text-muted-foreground max-w-[200px] truncate" title={p.client_id}>
                            {p.client_id}
                          </TableCell>
                          <TableCell className="px-8 py-4">
                            <Badge variant={p.enabled ? 'secondary' : 'outline'} className={p.enabled ? 'bg-emerald-500/10 text-emerald-400 border-0' : ''}>
                              {p.enabled ? t('oauth.enabled') : t('oauth.disabled')}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-8 py-4 text-xs font-mono text-muted-foreground max-w-[220px] truncate" title={p.callback_uri}>
                            {p.callback_uri}
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

      <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="w-5 h-5 text-primary" />
              {editingProvider ? t('oauth.editProviderTitle') : t('oauth.newProviderTitle')}
            </DialogTitle>
            <DialogDescription>
              {editingProvider ? t('oauth.editProviderDesc') : t('oauth.newProviderDesc')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={editingProvider ? handleUpdate : handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('oauth.providerLabel')}</Label>
              <div className="flex flex-wrap gap-3">
                {ALLOWED_PROVIDERS.map((prov) => (
                  <button
                    key={prov.value}
                    type="button"
                    title={prov.label}
                    disabled={!!editingProvider}
                    onClick={() => !editingProvider && setFormData((p) => ({ ...p, provider: prov.value }))}
                    className={`flex items-center justify-center p-3 rounded-xl border-2 transition-all hover:border-primary/50 disabled:opacity-70 disabled:cursor-not-allowed ${formData.provider === prov.value
                      ? 'border-primary bg-primary/40'
                      : 'border-input bg-muted/30'
                      }`}
                  >
                    <OAuthProviderLogo provider={prov.value} size={28} className="rounded" />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('oauth.nameOptional')}</Label>
              <Input
                placeholder={t('oauth.namePlaceholder')}
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Client ID *</Label>
              <Input
                required
                placeholder={t('oauth.clientIdPlaceholder')}
                value={formData.client_id}
                onChange={(e) => setFormData((p) => ({ ...p, client_id: e.target.value }))}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label>Client Secret {editingProvider ? '(optional)' : '*'}</Label>
              <Input
                required={!editingProvider}
                type="password"
                placeholder={editingProvider ? t('oauth.clientSecretLeaveEmpty') : '••••••••'}
                value={formData.client_secret}
                onChange={(e) => setFormData((p) => ({ ...p, client_secret: e.target.value }))}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('oauth.callbackLabel')}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateCallback}
                  className="gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {t('oauth.generate')}
                </Button>
              </div>
              <Input
                required
                readOnly
                placeholder={t('oauth.callbackKeyPlaceholder')}
                value={formData.callback_key}
                className="font-mono text-sm bg-muted/50 text-muted-foreground cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <Label>Callback URI *</Label>
              <div className="flex gap-2">
                <Input
                  required
                  readOnly
                  placeholder={t('oauth.callbackUriPlaceholder')}
                  value={formData.callback_uri}
                  className="font-mono text-sm flex-1 min-w-0 bg-muted/50 text-muted-foreground cursor-not-allowed"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title={t('oauth.copyUri')}
                  className={`shrink-0 transition-colors ${copyJustClicked ? 'bg-primary/20' : ''}`}
                  onClick={() => {
                    if (formData.callback_uri) {
                      navigator.clipboard.writeText(formData.callback_uri);
                      showNotification(t('oauth.callbackUriCopied'), 'success');
                      setCopyJustClicked(true);
                      setTimeout(() => setCopyJustClicked(false), 300);
                    }
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('oauth.scopesLabel')}</Label>
              <Input
                placeholder={t('oauth.scopesPlaceholder')}
                value={formData.scopes}
                onChange={(e) => setFormData((p) => ({ ...p, scopes: e.target.value }))}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label>{t('oauth.redirectWeb')}</Label>
              <Input
                required
                placeholder={t('oauth.redirectWebPlaceholder')}
                value={formData.redirect_uri_web}
                onChange={(e) => setFormData((p) => ({ ...p, redirect_uri_web: e.target.value }))}
                className="font-mono text-sm"
              />
            </div>

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" className="w-full justify-between text-muted-foreground hover:text-foreground">
                  <span>{t('oauth.redirectPlatform')}</span>
                  {advancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>{t('oauth.redirectAndroid')}</Label>
                  <Input
                    placeholder={t('oauth.redirectAndroidPlaceholder')}
                    value={formData.redirect_uri_android}
                    onChange={(e) => setFormData((p) => ({ ...p, redirect_uri_android: e.target.value }))}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('oauth.redirectIos')}</Label>
                  <Input
                    placeholder={t('oauth.redirectIosPlaceholder')}
                    value={formData.redirect_uri_ios}
                    onChange={(e) => setFormData((p) => ({ ...p, redirect_uri_ios: e.target.value }))}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('oauth.redirectDesktop')}</Label>
                  <Input
                    placeholder={t('oauth.redirectDesktopPlaceholder')}
                    value={formData.redirect_uri_desktop}
                    onChange={(e) => setFormData((p) => ({ ...p, redirect_uri_desktop: e.target.value }))}
                    className="font-mono text-sm"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label>{t('oauth.enabledLabel')}</Label>
                <p className="text-xs text-muted-foreground">{t('oauth.enabledDesc')}</p>
              </div>
              <Switch
                checked={formData.enabled}
                onCheckedChange={(v) => setFormData((p) => ({ ...p, enabled: v }))}
              />
            </div>

            <DialogFooter className="gap-4 pt-4">
              <Button type="button" variant="outline" onClick={closeModal}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting
                  ? (editingProvider ? t('oauth.updating') : t('oauth.creating'))
                  : (editingProvider ? t('oauth.updateProvider') : t('oauth.createProvider'))}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedProvider} onOpenChange={(open) => !open && setSelectedProvider(null)}>
        <DialogContent className="sm:max-w-2xl max-w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="w-5 h-5 text-primary" />
              {t('oauth.providerDetails')}
              {selectedProvider && (
                <span className="capitalize text-muted-foreground font-normal">
                  ({selectedProvider.provider}{selectedProvider.name ? ` · ${selectedProvider.name}` : ''})
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {t('oauth.providerConfig')}
            </DialogDescription>
          </DialogHeader>

          {selectedProvider && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">{t('oauth.id')}</Label>
                  <p className="text-sm font-mono break-all">{selectedProvider.id}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">{t('oauth.appId')}</Label>
                  <p className="text-sm font-mono break-all">{selectedProvider.app_id}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">{t('oauth.tableProvider')}</Label>
                  <div className="flex items-center gap-2">
                    <OAuthProviderLogo provider={selectedProvider.provider} size={28} className="rounded" />
                    <span className="text-sm font-semibold capitalize">{selectedProvider.provider}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">{t('oauth.tableState')}</Label>
                  <Badge variant={selectedProvider.enabled ? 'secondary' : 'outline'} className={selectedProvider.enabled ? 'bg-emerald-500/10 text-emerald-400 border-0' : ''}>
                    {selectedProvider.enabled ? t('oauth.enabled') : t('oauth.disabled')}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">{t('oauth.tableName')}</Label>
                <p className="text-sm">{selectedProvider.name || '—'}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">{t('oauth.tableClientId')}</Label>
                <p className="text-sm font-mono break-all bg-muted/50 rounded-lg p-3">{selectedProvider.client_id}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">{t('oauth.callbackKey')}</Label>
                <div className="flex gap-2 items-start">
                  <p className="text-sm font-mono break-all bg-muted/50 rounded-lg p-3 flex-1 min-w-0">{selectedProvider.callback_key}</p>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 h-9 w-9"
                    title={t('common.copy')}
                    onClick={() => {
                      navigator.clipboard.writeText(selectedProvider.callback_key);
                      showNotification(t('oauth.callbackKeyCopied'), 'success');
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">{t('oauth.callbackUri')}</Label>
                <div className="flex gap-2 items-start">
                  <p className="text-sm font-mono break-all bg-muted/50 rounded-lg p-3 flex-1 min-w-0">{selectedProvider.callback_uri}</p>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 h-9 w-9"
                    title={t('common.copy')}
                    onClick={() => {
                      navigator.clipboard.writeText(selectedProvider.callback_uri);
                      showNotification(t('oauth.callbackUriCopied'), 'success');
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">{t('oauth.scopes')}</Label>
                <p className="text-sm font-mono">{selectedProvider.scopes || '—'}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">{t('oauth.redirectWebLabel')}</Label>
                <div className="flex gap-2 items-start">
                  <p className="text-sm font-mono break-all bg-muted/50 rounded-lg p-3 flex-1 min-w-0">{selectedProvider.redirect_uri_web}</p>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 h-9 w-9"
                    title={t('common.copy')}
                    onClick={() => {
                      navigator.clipboard.writeText(selectedProvider.redirect_uri_web);
                      showNotification(t('oauth.redirectUriCopied'), 'success');
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {(selectedProvider.redirect_uri_android || selectedProvider.redirect_uri_ios || selectedProvider.redirect_uri_desktop) && (
                <div className="space-y-3 pt-2 border-t">
                  <Label className="text-muted-foreground text-xs">{t('oauth.platformUris')}</Label>
                  <div className="space-y-2">
                    {selectedProvider.redirect_uri_android && (
                      <div className="flex gap-2 items-start">
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-muted-foreground block mb-1">{t('oauth.android')}</span>
                          <p className="text-sm font-mono break-all bg-muted/50 rounded-lg p-2">{selectedProvider.redirect_uri_android}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="shrink-0 h-9 w-9 mt-5"
                          title={t('common.copy')}
                          onClick={() => {
                            navigator.clipboard.writeText(selectedProvider.redirect_uri_android!);
                            showNotification(t('oauth.redirectUriCopied'), 'success');
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    {selectedProvider.redirect_uri_ios && (
                      <div className="flex gap-2 items-start">
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-muted-foreground block mb-1">{t('oauth.ios')}</span>
                          <p className="text-sm font-mono break-all bg-muted/50 rounded-lg p-2">{selectedProvider.redirect_uri_ios}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="shrink-0 h-9 w-9 mt-5"
                          title={t('common.copy')}
                          onClick={() => {
                            navigator.clipboard.writeText(selectedProvider.redirect_uri_ios!);
                            showNotification(t('oauth.redirectUriCopied'), 'success');
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    {selectedProvider.redirect_uri_desktop && (
                      <div className="flex gap-2 items-start">
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-muted-foreground block mb-1">{t('oauth.desktop')}</span>
                          <p className="text-sm font-mono break-all bg-muted/50 rounded-lg p-2">{selectedProvider.redirect_uri_desktop}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="shrink-0 h-9 w-9 mt-5"
                          title={t('common.copy')}
                          onClick={() => {
                            navigator.clipboard.writeText(selectedProvider.redirect_uri_desktop!);
                            showNotification(t('oauth.redirectUriCopied'), 'success');
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <DialogFooter className="pt-4 gap-2 flex-wrap">
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    if (selectedProvider) {
                      setLinkDialogProvider(selectedProvider);
                      setLinkPlatform('web');
                      setLinkRole(roles.length > 0 ? roles[0].name : 'default');
                      setLinkResult(null);
                    }
                  }}
                >
                  <Link2 className="w-4 h-4" />
                  {t('oauth.fetchLink')}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <MoreVertical className="w-4 h-4" />
                      {t('oauth.options')}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[160px]">
                    <DropdownMenuItem onClick={() => selectedProvider && openEditModal(selectedProvider)} className="gap-2">
                      <Pencil className="w-4 h-4" />
                      {t('oauth.editProvider')}
                    </DropdownMenuItem>
                    {selectedProvider?.enabled ? (
                      <DropdownMenuItem
                        onClick={handleDisableProvider}
                        disabled={!!actionLoading}
                        className="gap-2 text-amber-600 focus:text-amber-600"
                      >
                        {actionLoading === 'disable' ? <Loader2 className="w-4 h-4 animate-spin" /> : <PowerOff className="w-4 h-4" />}
                        {actionLoading === 'disable' ? t('oauth.disabling') : t('oauth.disableProvider')}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={handleEnableProvider}
                        disabled={!!actionLoading}
                        className="gap-2 text-emerald-600 focus:text-emerald-600"
                      >
                        {actionLoading === 'enable' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                        {actionLoading === 'enable' ? t('oauth.enabling') : t('oauth.enableProvider')}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={handleDeleteProvider}
                      disabled={!!actionLoading}
                      className="gap-2 text-destructive focus:text-destructive"
                    >
                      {actionLoading === 'delete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      {actionLoading === 'delete' ? t('oauth.deleting') : t('oauth.deleteProvider')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!linkDialogProvider} onOpenChange={(open) => !open && setLinkDialogProvider(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              {t('oauth.getLink')}
              {linkDialogProvider && (
                <span className="capitalize text-muted-foreground font-normal">
                  ({linkDialogProvider.provider})
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {t('oauth.getLinkDesc')}
            </DialogDescription>
          </DialogHeader>

          {linkDialogProvider && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('oauth.platformLabel')}</Label>
                <div className="flex flex-wrap gap-2">
                  {OAUTH_PLATFORMS.map((pl) => (
                    <Button
                      key={pl.value}
                      type="button"
                      variant={linkPlatform === pl.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setLinkPlatform(pl.value)}
                    >
                      {pl.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('oauth.roleLabel')}</Label>
                <select
                  value={linkRole}
                  onChange={(e) => setLinkRole(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="default">default</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}{r.description ? ` — ${r.description}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {!savedPublishableKey && (
                <p className="text-sm text-amber-400">{t('oauth.publishableKeyRequired')}</p>
              )}
              <DialogFooter className="gap-4 justify-between">
                <Button variant="outline" onClick={() => setLinkDialogProvider(null)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={handleFetchOAuthLink}
                  disabled={linkLoading || !savedPublishableKey}
                  className="gap-2"
                >
                  {linkLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {linkLoading ? t('oauth.fetchingLink') : t('oauth.fetchLink')}
                </Button>
              </DialogFooter>

              {linkResult && (
                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-muted-foreground text-xs">{t('oauth.resultLink')}</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={linkResult}
                      className="font-mono text-xs flex-1 min-w-0 bg-muted/50"
                    />
                    <Button variant="outline" size="icon" onClick={handleCopyLink} title={t('oauth.copyUri')}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
