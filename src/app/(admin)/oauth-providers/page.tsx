'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LogIn, Plus, Loader2, Key, ChevronDown, ChevronUp, ShieldCheck, RefreshCw, Copy } from 'lucide-react';
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
import type { OAuthConfig } from '@/lib/admin-types';

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

const ALLOWED_PROVIDERS = [
  { value: 'google', label: 'Google' },
  { value: 'microsoft', label: 'Microsoft' },
  { value: 'apple', label: 'Apple' },
  { value: 'github', label: 'GitHub' },
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
  const { apiUrl, showNotification, savedSecretKey } = useAdmin();
  const { t } = useI18n();
  const [providers, setProviders] = useState<OAuthConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<OAuthConfig | null>(null);
  const [formData, setFormData] = useState<OAuthConfigForm>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [copyJustClicked, setCopyJustClicked] = useState(false);

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

  const generateRandomCallbackKey = (): string => {
    const array = new Uint8Array(24);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    }
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  };

  useEffect(() => {
    if (!isModalOpen || !savedSecretKey) return;
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
  }, [isModalOpen, savedSecretKey, apiUrl, showNotification]);

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
    setFormData(initialForm);
    setAdvancedOpen(false);
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
                      {providers.map((p) => (
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
              {t('oauth.newProviderTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('oauth.newProviderDesc')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('oauth.providerLabel')}</Label>
              <div className="flex flex-wrap gap-3">
                {ALLOWED_PROVIDERS.map((prov) => (
                  <button
                    key={prov.value}
                    type="button"
                    title={prov.label}
                    onClick={() => setFormData((p) => ({ ...p, provider: prov.value }))}
                    className={`flex items-center justify-center p-3 rounded-xl border-2 transition-all hover:border-primary/50 ${
                      formData.provider === prov.value
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
              <Label>Client Secret *</Label>
              <Input
                required
                type="password"
                placeholder="••••••••"
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
                {isSubmitting ? t('oauth.creating') : t('oauth.createProvider')}
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
                <p className="text-sm font-mono break-all bg-muted/50 rounded-lg p-3">{selectedProvider.callback_key}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">{t('oauth.callbackUri')}</Label>
                <p className="text-sm font-mono break-all bg-muted/50 rounded-lg p-3">{selectedProvider.callback_uri}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">{t('oauth.scopes')}</Label>
                <p className="text-sm font-mono">{selectedProvider.scopes || '—'}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">{t('oauth.redirectWebLabel')}</Label>
                <p className="text-sm font-mono break-all bg-muted/50 rounded-lg p-3">{selectedProvider.redirect_uri_web}</p>
              </div>

              {(selectedProvider.redirect_uri_android || selectedProvider.redirect_uri_ios || selectedProvider.redirect_uri_desktop) && (
                <div className="space-y-3 pt-2 border-t">
                  <Label className="text-muted-foreground text-xs">{t('oauth.platformUris')}</Label>
                  <div className="space-y-2">
                    {selectedProvider.redirect_uri_android && (
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">{t('oauth.android')}</span>
                        <p className="text-sm font-mono break-all bg-muted/50 rounded-lg p-2">{selectedProvider.redirect_uri_android}</p>
                      </div>
                    )}
                    {selectedProvider.redirect_uri_ios && (
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">{t('oauth.ios')}</span>
                        <p className="text-sm font-mono break-all bg-muted/50 rounded-lg p-2">{selectedProvider.redirect_uri_ios}</p>
                      </div>
                    )}
                    {selectedProvider.redirect_uri_desktop && (
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">{t('oauth.desktop')}</span>
                        <p className="text-sm font-mono break-all bg-muted/50 rounded-lg p-2">{selectedProvider.redirect_uri_desktop}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <DialogFooter className="pt-4">
                <Button variant="outline" onClick={() => setSelectedProvider(null)}>
                  {t('oauth.close')}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
