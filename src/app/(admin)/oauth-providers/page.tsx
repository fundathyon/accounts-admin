'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { LogIn, Plus, Key, ShieldCheck, RefreshCw, Copy, Link2, Pencil, Trash2, Power, PowerOff, MoreVertical, Search, Filter, MinusCircle, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import {
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  FormField,
  Heading,
  Icon,
  IconButton,
  Input,
  Select,
  Spinner,
  Switch,
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
import { OAuthProviderLogo } from '@/components/oauth-provider-logo';
import { OAuthNativeAudiences } from '@/components/oauth-native-audiences';
import type { OAuthConfig, OAuthRedirectItem, Role } from '@/lib/admin-types';

type OAuthPlatform = OAuthRedirectItem['platform'];

/** Row from GET /oauth-configs/:id/redirects (Secret Key). */
interface OAuthRedirectOption {
  url: string;
  platform: string;
  name?: string;
  rt: string;
  /** True when URL comes from oauth_configs legacy columns (omit redirect_url on get-link). */
  legacy?: boolean;
}

interface RedirectsLegacyDeprecation {
  active: boolean;
  deprecation_version: string;
  message: string;
}

interface RedirectFormRow {
  id: string;
  url: string;
  platform: OAuthPlatform;
  name: string;
}

function newRowId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function normalizeRedirectsPayload(rows: RedirectFormRow[]): OAuthRedirectItem[] {
  return rows
    .filter((r) => r.url.trim() && r.platform)
    .map((r) => ({
      url: r.url.trim(),
      platform: r.platform,
      ...(r.name.trim() ? { name: r.name.trim() } : {}),
    }));
}

function redirectsFromProvider(p: OAuthConfig): RedirectFormRow[] {
  const list = p.redirects;
  if (Array.isArray(list) && list.length > 0) {
    return list.map((r) => ({
      id: r.rt || newRowId(),
      url: r.url ?? '',
      platform: (r.platform as OAuthPlatform) || 'web',
      name: r.name ?? '',
    }));
  }
  const rows: RedirectFormRow[] = [];
  if (p.redirect_uri_web?.trim()) rows.push({ id: newRowId(), url: p.redirect_uri_web.trim(), platform: 'web', name: '' });
  if (p.redirect_uri_android?.trim()) rows.push({ id: newRowId(), url: p.redirect_uri_android.trim(), platform: 'android', name: '' });
  if (p.redirect_uri_ios?.trim()) rows.push({ id: newRowId(), url: p.redirect_uri_ios.trim(), platform: 'ios', name: '' });
  if (p.redirect_uri_desktop?.trim()) rows.push({ id: newRowId(), url: p.redirect_uri_desktop.trim(), platform: 'desktop', name: '' });
  return rows;
}

/** First URL per platform for API legacy columns (callback sin `rt`). */
function deriveLegacyRedirectUris(rows: RedirectFormRow[]) {
  const norm = normalizeRedirectsPayload(rows);
  const first = (platform: OAuthPlatform) => norm.find((r) => r.platform === platform)?.url?.trim() ?? '';
  return {
    redirect_uri_web: first('web'),
    redirect_uri_android: first('android') || undefined,
    redirect_uri_ios: first('ios') || undefined,
    redirect_uri_desktop: first('desktop') || undefined,
  };
}

function truncateKey(key: string) {
  if (!key || key.length <= 20) return key;
  return key.slice(0, 12) + '••••••••••••' + key.slice(-8);
}
import { FieldHint } from '@/components/ui/field-hint';

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
  redirects: RedirectFormRow[];
}

const initialForm: OAuthConfigForm = {
  provider: 'google',
  name: '',
  client_id: '',
  client_secret: '',
  callback_key: '',
  callback_uri: '',
  scopes: 'email profile openid',
  enabled: true,
  redirects: [],
};

export default function OAuthProvidersPage() {
  const {
    apiUrl,
    showNotification,
    savedSecretKey,
    savedPublishableKey,
    setPendingOAuthLegacyMigration,
  } = useAdmin();
  const { t } = useI18n();
  const [providers, setProviders] = useState<OAuthConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<OAuthConfig | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<OAuthConfig | null>(null);
  const [formData, setFormData] = useState<OAuthConfigForm>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copyJustClicked, setCopyJustClicked] = useState(false);
  const [linkDialogProvider, setLinkDialogProvider] = useState<OAuthConfig | null>(null);
  const [linkPlatform, setLinkPlatform] = useState<string>('web');
  const [linkRole, setLinkRole] = useState<string>('default');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkResult, setLinkResult] = useState<string | null>(null);
  const [linkRedirectUrl, setLinkRedirectUrl] = useState('');
  const [linkRt, setLinkRt] = useState('');
  const [linkRedirectOptions, setLinkRedirectOptions] = useState<OAuthRedirectOption[]>([]);
  const [linkLegacyDeprecation, setLinkLegacyDeprecation] = useState<RedirectsLegacyDeprecation | null>(null);
  const [linkRedirectsLoading, setLinkRedirectsLoading] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [migrationPendingIds, setMigrationPendingIds] = useState<Set<string>>(new Set());
  const [migrationPending, setMigrationPending] = useState(false);
  const [migrationApplyLoading, setMigrationApplyLoading] = useState(false);

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

  useEffect(() => {
    if (!savedSecretKey?.trim()) {
      setMigrationPending(false);
      setMigrationPendingIds(new Set());
      setPendingOAuthLegacyMigration(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl('/api/oauth-configs/migration/legacy-redirects-status'), {
          credentials: 'include',
          headers: { 'X-Secret-API-Key': savedSecretKey },
        });
        const raw = await res.text();
        let data: {
          success?: boolean;
          data?: { pending_migration?: boolean; pending?: { oauth_config_id: string }[] };
        } = {};
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          if (!cancelled) {
            setMigrationPending(false);
            setMigrationPendingIds(new Set());
            setPendingOAuthLegacyMigration(false);
          }
          return;
        }
        if (cancelled || !res.ok || !data.success) {
          if (!cancelled) {
            setMigrationPending(false);
            setMigrationPendingIds(new Set());
            setPendingOAuthLegacyMigration(false);
          }
          return;
        }
        const list = data.data?.pending ?? [];
        const ids = new Set(list.map((x) => x.oauth_config_id));
        const pending = !!data.data?.pending_migration;
        setMigrationPending(pending);
        setMigrationPendingIds(ids);
        setPendingOAuthLegacyMigration(pending);
      } catch {
        if (!cancelled) {
          setMigrationPending(false);
          setMigrationPendingIds(new Set());
          setPendingOAuthLegacyMigration(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [savedSecretKey, apiUrl, setPendingOAuthLegacyMigration]);

  const handleRunLegacyMigration = async () => {
    if (!savedSecretKey?.trim()) {
      showNotification(t('oauth.secretKeyRequired'), 'error');
      return;
    }
    setMigrationApplyLoading(true);
    try {
      const res = await fetch(apiUrl('/api/oauth-configs/migration/legacy-redirects-apply'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Secret-API-Key': savedSecretKey },
      });
      const raw = await res.text();
      let data: { success?: boolean; error?: { message?: string } } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        showNotification(t('oauth.errorConnection'), 'error');
        return;
      }
      if (data.success) {
        showNotification(t('oauth.migrationSuccess'), 'success');
        setMigrationPending(false);
        setMigrationPendingIds(new Set());
        setPendingOAuthLegacyMigration(false);
        fetchProviders();
      } else {
        showNotification(data.error?.message || t('oauth.migrationError'), 'error');
      }
    } catch {
      showNotification(t('oauth.errorConnection'), 'error');
    } finally {
      setMigrationApplyLoading(false);
    }
  };

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

  useEffect(() => {
    if (!linkDialogProvider || !savedSecretKey) {
      setLinkRedirectOptions([]);
      setLinkLegacyDeprecation(null);
      setLinkRedirectsLoading(false);
      return;
    }
    let cancelled = false;
    setLinkRedirectsLoading(true);
    fetch(apiUrl(`/api/oauth-configs/${encodeURIComponent(linkDialogProvider.id)}/redirects`), {
      headers: { 'X-Secret-API-Key': savedSecretKey },
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.success || data.data == null) {
          setLinkRedirectOptions([]);
          setLinkLegacyDeprecation(null);
          return;
        }
        const raw = data.data as OAuthRedirectOption[] | { redirects?: OAuthRedirectOption[]; legacy_deprecation?: RedirectsLegacyDeprecation };
        if (Array.isArray(raw)) {
          setLinkRedirectOptions(raw);
          setLinkLegacyDeprecation(null);
          return;
        }
        const list = Array.isArray(raw.redirects) ? raw.redirects : [];
        setLinkRedirectOptions(list);
        setLinkLegacyDeprecation(raw.legacy_deprecation && raw.legacy_deprecation.active ? raw.legacy_deprecation : null);
      })
      .catch(() => {
        if (!cancelled) {
          setLinkRedirectOptions([]);
          setLinkLegacyDeprecation(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLinkRedirectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [linkDialogProvider, savedSecretKey, apiUrl]);

  const linkRedirectsForPlatform = useMemo(
    () => linkRedirectOptions.filter((r) => r.platform === linkPlatform),
    [linkRedirectOptions, linkPlatform]
  );

  /** Por defecto la primera URL de la plataforma; al cambiar plataforma o lista, si la selección actual no aplica, se usa la primera. */
  useEffect(() => {
    const list = linkRedirectOptions.filter((r) => r.platform === linkPlatform);
    if (list.length === 0) {
      setLinkRedirectUrl('');
      return;
    }
    const firstUrl = list[0].url;
    setLinkRedirectUrl((prev) => {
      if (list.some((r) => r.url === prev)) return prev;
      return firstUrl;
    });
  }, [linkPlatform, linkRedirectOptions]);

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
      !formData.callback_key?.trim() || !formData.callback_uri?.trim()) {
      showNotification(t('oauth.completeFields'), 'error');
      return;
    }
    const legacy = deriveLegacyRedirectUris(formData.redirects);
    if (!legacy.redirect_uri_web.trim()) {
      showNotification(t('oauth.redirectWebRequired'), 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const redirectsPayload = normalizeRedirectsPayload(formData.redirects);
      const payload: Record<string, unknown> = {
        provider: formData.provider.trim(),
        name: formData.name.trim() || undefined,
        client_id: formData.client_id.trim(),
        client_secret: formData.client_secret.trim(),
        callback_key: formData.callback_key.trim(),
        callback_uri: formData.callback_uri.trim(),
        scopes: formData.scopes.trim() || undefined,
        enabled: formData.enabled,
        redirect_uri_web: legacy.redirect_uri_web,
        redirect_uri_android: legacy.redirect_uri_android,
        redirect_uri_ios: legacy.redirect_uri_ios,
        redirect_uri_desktop: legacy.redirect_uri_desktop,
        redirects: redirectsPayload,
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
  };

  const openCreateModal = () => {
    setEditingProvider(null);
    setFormData(initialForm);
    setIsModalOpen(true);
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
      redirects: redirectsFromProvider(provider),
    });
    setEditingProvider(provider);
    setSelectedProvider(null);
    setIsModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProvider) return;
    if (!formData.client_id?.trim() || !formData.callback_key?.trim() || !formData.callback_uri?.trim()) {
      showNotification(t('oauth.completeFields'), 'error');
      return;
    }
    const legacy = deriveLegacyRedirectUris(formData.redirects);
    if (!legacy.redirect_uri_web.trim()) {
      showNotification(t('oauth.redirectWebRequired'), 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const redirectsPayload = normalizeRedirectsPayload(formData.redirects);
      const payload: Record<string, unknown> = {
        provider: editingProvider.provider,
        name: formData.name.trim() || undefined,
        client_id: formData.client_id.trim(),
        callback_key: formData.callback_key.trim(),
        callback_uri: formData.callback_uri.trim(),
        scopes: formData.scopes.trim() || undefined,
        enabled: formData.enabled,
        redirect_uri_web: legacy.redirect_uri_web,
        redirect_uri_android: legacy.redirect_uri_android,
        redirect_uri_ios: legacy.redirect_uri_ios,
        redirect_uri_desktop: legacy.redirect_uri_desktop,
        redirects: redirectsPayload,
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
    setLinkRedirectUrl('');
    setLinkRt('');
    setLinkResult(null);
  };

  const handleFetchOAuthLink = async () => {
    if (!linkDialogProvider || !savedPublishableKey) return;
    const redirectTarget =
      linkRedirectUrl.trim() || linkRedirectsForPlatform[0]?.url?.trim() || '';
    const selectedRow =
      linkRedirectsForPlatform.find((r) => r.url === linkRedirectUrl) ?? linkRedirectsForPlatform[0];
    const useLegacyLink = selectedRow?.legacy === true;
    if (!redirectTarget) {
      showNotification(t('oauth.linkRedirectRequired'), 'error');
      return;
    }
    setLinkLoading(true);
    setLinkResult(null);
    try {
      let qs = `provider=${encodeURIComponent(linkDialogProvider.provider)}&platform=${encodeURIComponent(linkPlatform)}&role=${encodeURIComponent(linkRole)}`;
      if (!useLegacyLink) {
        qs += `&redirect_url=${encodeURIComponent(redirectTarget)}`;
      }
      const url = apiUrl(`/api/oauths/link?${qs}`);
      const res = await fetch(url, {
        headers: { 'X-Publishable-API-Key': savedPublishableKey },
      });
      const data = await res.json();
      if (data.success && data.data) {
        const link = String(data.data);
        setLinkResult(link);
        try {
          await navigator.clipboard.writeText(link);
          showNotification(t('oauth.linkFetchedAndCopied'), 'success');
        } catch {
          showNotification(t('oauth.linkFetchedClipboardFail'), 'warning');
        }
      } else {
        showNotification(data.error?.message || t('oauth.errorLink'), 'error');
      }
    } catch {
      showNotification(t('oauth.errorConnection'), 'error');
    } finally {
      setLinkLoading(false);
    }
  };

  const [rowLinkLoadingKey, setRowLinkLoadingKey] = useState<string | null>(null);

  const handleCopyLinkForRedirectRow = async (row: OAuthRedirectItem) => {
    if (!selectedProvider) return;
    if (!savedPublishableKey) {
      showNotification(t('oauth.publishableKeyRequiredForCopy'), 'error');
      return;
    }
    const rowKey = `${row.platform}-${row.url}`;
    setRowLinkLoadingKey(rowKey);
    try {
      const role = roles.length > 0 ? roles[0].name : 'default';
      const qs =
        `provider=${encodeURIComponent(selectedProvider.provider)}` +
        `&platform=${encodeURIComponent(row.platform)}` +
        `&role=${encodeURIComponent(role)}` +
        `&redirect_url=${encodeURIComponent(row.url)}`;
      const res = await fetch(apiUrl(`/api/oauths/link?${qs}`), {
        headers: { 'X-Publishable-API-Key': savedPublishableKey },
      });
      const data = await res.json();
      if (data.success && data.data) {
        await navigator.clipboard.writeText(String(data.data));
        showNotification(t('oauth.copyOAuthLinkSuccess'), 'success');
      } else {
        showNotification(data.error?.message || t('oauth.copyOAuthLinkError'), 'error');
      }
    } catch {
      showNotification(t('oauth.copyOAuthLinkError'), 'error');
    } finally {
      setRowLinkLoadingKey(null);
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
            <Link
              href={settingsHref}
              className={cn(
                buttonVariants({ variant: 'secondary', size: 'sm' }),
                'gap-2 border-amber-500/20 text-amber-500 hover:bg-amber-500/10'
              )}
            >
              <Key className="w-4 h-4" /> {t('oauth.configSecretKey')}
            </Link>
          ) : (
            <Tooltip content={t('tooltips.newOAuth')}>
              <Button variant="primary" onClick={openCreateModal} className="gap-2">
                <Plus className="w-4 h-4" /> Nuevo Proveedor OAuth
              </Button>
            </Tooltip>
          )}
        </div>

        {!savedSecretKey ? (
          <Card className="border-amber-500/20 gap-6 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <Key className="w-8 h-8 text-amber-400" />
            </div>
            <Heading level={2} visual="h3" className="text-amber-300 mb-2">
              {t('oauth.secretKeyRequired')}
            </Heading>
            <Text tone="secondary" className="mb-6">
              {t('oauth.configSecretKeyCard')}
            </Text>
            <Link href={settingsHref} className={buttonVariants({ variant: 'primary', size: 'sm' })}>
              {t('oauth.goToSettings')}
            </Link>
          </Card>
        ) : loading ? (
          <div className="py-20 flex justify-center">
            <Spinner size={20} label={t('common.loading')} className="text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="px-6 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-2 text-xs text-emerald-400">
              <ShieldCheck className="w-4 h-4" /> {t('oauth.consultingWith')} <span className="font-mono">{truncateKey(savedSecretKey)}</span>
            </div>

            {migrationPending && (
              <div
                role="status"
                className="rounded-2xl border border-red-500/50 bg-red-500/10 px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1.5 min-w-0">
                  <p className="text-sm font-semibold text-red-100 flex items-center gap-2">
                    <AlertTriangle className="size-4 shrink-0 text-red-400" />
                    {t('oauth.migrationBannerTitle')}
                    <FieldHint text={t('oauth.hints.migrationBanner')} className="text-red-200/80 hover:text-red-100" />
                  </p>
                  <p className="text-xs text-red-200/80 leading-relaxed">{t('oauth.migrationV1Deprecation')}</p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  className="shrink-0 gap-2 w-full sm:w-auto"
                  onClick={handleRunLegacyMigration}
                  disabled={migrationApplyLoading}
                >
                  {migrationApplyLoading ? <Spinner size={16} label={null} /> : <AlertTriangle className="size-4" />}
                  {migrationApplyLoading ? t('notifications.migrating') : t('oauth.runMigration')}
                </Button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-2xl border border-border/50">
              <div className="relative flex-1 min-w-[300px]">
                <Input
                  leading={<Search className="w-4 h-4 text-muted-foreground" />}
                  placeholder={t('oauth.searchPlaceholder') || "Search by name, provider or ID..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  wrapperClassName="h-10 border-none bg-background shadow-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <Tooltip content={t('tooltips.oauth')}>
                  <span className="relative inline-flex items-center">
                    <Filter className="pointer-events-none absolute left-2.5 w-3.5 h-3.5 text-muted-foreground" />
                    <Select
                      value={providerFilter}
                      onValueChange={(v) => setProviderFilter(v ?? 'all')}
                      placeholder={t('oauth.provider') || "Provider"}
                      className="w-[140px] h-10 pl-8 border-none bg-background shadow-none"
                      items={[
                        { value: 'all', label: t('common.all') || "All" },
                        ...ALLOWED_PROVIDERS.map((p) => ({ value: p.value, label: p.label })),
                      ]}
                    />
                  </span>
                </Tooltip>

                <Tooltip content={t('tooltips.state')}>
                  <span className="relative inline-flex items-center">
                    <ShieldCheck className="pointer-events-none absolute left-2.5 w-3.5 h-3.5 text-muted-foreground" />
                    <Select
                      value={statusFilter}
                      onValueChange={(v) => setStatusFilter((v ?? 'all') as 'all' | 'enabled' | 'disabled')}
                      placeholder={t('users.state') || "State"}
                      className="w-[140px] h-10 pl-8 border-none bg-background shadow-none"
                      items={[
                        { value: 'all', label: t('common.all') || "Both" },
                        { value: 'enabled', label: t('oauth.enabled') || "Enabled" },
                        { value: 'disabled', label: t('oauth.disabled') || "Disabled" },
                      ]}
                    />
                  </span>
                </Tooltip>
              </div>
            </div>

            {providers.length === 0 ? (
              <Card className="border-dashed gap-6 p-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mx-auto mb-4">
                  <LogIn className="w-8 h-8 text-rose-400" />
                </div>
                <Heading level={2} visual="h3" className="mb-2">
                  {t('oauth.noProviders')}
                </Heading>
                <Text tone="secondary" className="mb-6">
                  {t('oauth.noProvidersDesc')}
                </Text>
                <Button variant="primary" onClick={openCreateModal} className="gap-2">
                  <Plus className="w-4 h-4" /> {t('oauth.addProvider')}
                </Button>
              </Card>
            ) : (
              <Table className="overflow-hidden">
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
                      interactive
                      className="group transition-colors"
                      onClick={() => setSelectedProvider(p)}
                    >
                      <TableCell className="px-8 py-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <OAuthProviderLogo provider={p.provider} size={28} className="rounded shrink-0" />
                          {migrationPendingIds.has(p.id) ? (
                            <Tooltip content={t('oauth.migrationRowTooltip')} side="top" className="max-w-xs whitespace-normal">
                              <span
                                className="inline-flex size-2.5 shrink-0 rounded-full bg-red-500 ring-2 ring-background"
                                aria-label={t('oauth.migrationRowTooltip')}
                              />
                            </Tooltip>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="px-8 py-4 text-muted-foreground">{p.name || '—'}</TableCell>
                      <TableCell className="px-8 py-4 text-xs font-mono text-muted-foreground max-w-[200px] truncate" title={p.client_id}>
                        {p.client_id}
                      </TableCell>
                      <TableCell className="px-8 py-4">
                        <Badge variant={p.enabled ? 'tonal' : 'outline'} tone={p.enabled ? 'success' : 'neutral'}>
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
            )}
          </div>
        )}
      </motion.div>

      <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="w-5 h-5 text-accent" />
              {editingProvider ? t('oauth.editProviderTitle') : t('oauth.newProviderTitle')}
            </DialogTitle>
            <DialogDescription>
              {editingProvider ? t('oauth.editProviderDesc') : t('oauth.newProviderDesc')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={editingProvider ? handleUpdate : handleCreate} className="space-y-4">
            <FormField
              label={
                <>
                  {t('oauth.providerLabel')}
                  <FieldHint text={t('oauth.hints.provider')} />
                </>
              }
            >
              <div className="flex flex-wrap gap-3">
                {ALLOWED_PROVIDERS.map((prov) => (
                  <button
                    key={prov.value}
                    type="button"
                    title={prov.label}
                    disabled={!!editingProvider}
                    onClick={() => !editingProvider && setFormData((p) => ({ ...p, provider: prov.value }))}
                    className={`flex items-center justify-center p-3 rounded-xl border-2 transition-all hover:border-accent-border disabled:opacity-70 disabled:cursor-not-allowed ${formData.provider === prov.value
                      ? 'border-accent-border bg-accent-bg'
                      : 'border-input bg-muted/30'
                      }`}
                  >
                    <OAuthProviderLogo provider={prov.value} size={28} className="rounded" />
                  </button>
                ))}
              </div>
            </FormField>

            <FormField label={t('oauth.nameOptional')}>
              <Input
                placeholder={t('oauth.namePlaceholder')}
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
            </FormField>

            <FormField
              label={
                <>
                  Client ID *
                  <FieldHint text={t('oauth.hints.clientId')} />
                </>
              }
            >
              <Input
                required
                placeholder={t('oauth.clientIdPlaceholder')}
                value={formData.client_id}
                onChange={(e) => setFormData((p) => ({ ...p, client_id: e.target.value }))}
                className="font-mono text-sm"
              />
            </FormField>

            <FormField
              label={
                <>
                  Client Secret {editingProvider ? '(optional)' : '*'}
                  <FieldHint text={t('oauth.hints.clientSecret')} />
                </>
              }
            >
              <Input
                required={!editingProvider}
                type="password"
                placeholder={editingProvider ? t('oauth.clientSecretLeaveEmpty') : '••••••••'}
                value={formData.client_secret}
                onChange={(e) => setFormData((p) => ({ ...p, client_secret: e.target.value }))}
                className="font-mono text-sm"
              />
            </FormField>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Text as="span" variant="label" className="flex items-center gap-1.5">
                  {t('oauth.callbackLabel')}
                  <FieldHint text={t('oauth.hints.callback')} />
                </Text>
                <Button
                  type="button"
                  variant="secondary"
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
                className="font-mono text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>

            <FormField label="Callback URI *">
              <div className="flex gap-2">
                <Input
                  required
                  readOnly
                  placeholder={t('oauth.callbackUriPlaceholder')}
                  value={formData.callback_uri}
                  wrapperClassName="flex-1 min-w-0"
                  className="font-mono text-sm text-muted-foreground cursor-not-allowed"
                />
                <IconButton
                  type="button"
                  icon={Copy}
                  label={t('oauth.copyUri')}
                  variant="secondary"
                  className={`shrink-0 transition-colors ${copyJustClicked ? 'bg-accent-bg' : ''}`}
                  onClick={() => {
                    if (formData.callback_uri) {
                      navigator.clipboard.writeText(formData.callback_uri);
                      showNotification(t('oauth.callbackUriCopied'), 'success');
                      setCopyJustClicked(true);
                      setTimeout(() => setCopyJustClicked(false), 300);
                    }
                  }}
                />
              </div>
            </FormField>

            <FormField
              label={
                <>
                  {t('oauth.scopesLabel')}
                  <FieldHint text={t('oauth.hints.scopes')} />
                </>
              }
            >
              <Input
                placeholder={t('oauth.scopesPlaceholder')}
                value={formData.scopes}
                onChange={(e) => setFormData((p) => ({ ...p, scopes: e.target.value }))}
                className="font-mono text-sm"
              />
            </FormField>

            <div className="space-y-3 rounded-lg border border-border/60 p-4">
              <div>
                <Text as="span" variant="label" className="flex items-center gap-1.5">
                  {t('oauth.redirectWhitelist')}
                  <FieldHint text={t('oauth.hints.redirectWhitelist')} />
                </Text>
                <p className="text-xs text-muted-foreground mt-1">{t('oauth.redirectWhitelistHint')}</p>
              </div>
              <div className="space-y-3">
                {formData.redirects.map((row, idx) => (
                  <div key={row.id} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <FormField
                      className="sm:w-[130px]"
                      label={
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          {t('oauth.platformLabel')}
                          {idx === 0 && <FieldHint text={t('oauth.hints.platform')} className="text-muted-foreground/60" />}
                        </span>
                      }
                    >
                      <Select
                        value={row.platform}
                        onValueChange={(v) => {
                          setFormData((p) => {
                            const next = [...p.redirects];
                            next[idx] = { ...next[idx], platform: (v ?? 'web') as OAuthPlatform };
                            return { ...p, redirects: next };
                          });
                        }}
                        className="h-9"
                        items={OAUTH_PLATFORMS.map((pl) => ({ value: pl.value, label: pl.label }))}
                      />
                    </FormField>
                    <FormField
                      className="flex-1 min-w-0"
                      label={<span className="text-xs text-muted-foreground">{t('oauth.redirectUrlRow')}</span>}
                    >
                      <Input
                        placeholder={t('oauth.redirectWebPlaceholder')}
                        value={row.url}
                        onChange={(e) => {
                          setFormData((p) => {
                            const next = [...p.redirects];
                            next[idx] = { ...next[idx], url: e.target.value };
                            return { ...p, redirects: next };
                          });
                        }}
                        className="font-mono text-sm"
                      />
                    </FormField>
                    <FormField
                      className="flex-1 min-w-0 sm:max-w-[200px]"
                      label={
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          {t('oauth.rowNameOptional')}
                          {idx === 0 && <FieldHint text={t('oauth.hints.rowName')} className="text-muted-foreground/60" />}
                        </span>
                      }
                    >
                      <Input
                        placeholder="—"
                        value={row.name}
                        onChange={(e) => {
                          setFormData((p) => {
                            const next = [...p.redirects];
                            next[idx] = { ...next[idx], name: e.target.value };
                            return { ...p, redirects: next };
                          });
                        }}
                      />
                    </FormField>
                    <IconButton
                      type="button"
                      icon={MinusCircle}
                      label={t('common.delete')}
                      variant="ghost"
                      className="shrink-0 h-9 w-9 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setFormData((p) => ({
                          ...p,
                          redirects: p.redirects.filter((_, i) => i !== idx),
                        }));
                      }}
                    />
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2"
                onClick={() => {
                  setFormData((p) => ({
                    ...p,
                    redirects: [...p.redirects, { id: newRowId(), url: '', platform: 'web', name: '' }],
                  }));
                }}
              >
                <Plus className="w-4 h-4" />
                {t('oauth.addRedirectUrl')}
              </Button>
            </div>

            <div className="rounded-lg border p-4">
              <Switch
                label={t('oauth.enabledLabel')}
                description={t('oauth.enabledDesc')}
                checked={formData.enabled}
                onCheckedChange={(v) => setFormData((p) => ({ ...p, enabled: v }))}
              />
            </div>

            <DialogFooter className="gap-4 pt-4">
              <Button type="button" variant="secondary" onClick={closeModal}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="primary" disabled={isSubmitting} className="gap-2">
                {isSubmitting && <Spinner size={16} label={null} />}
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
              <LogIn className="w-5 h-5 text-accent" />
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
                  <Text as="div" variant="label" tone="muted" className="text-xs">{t('oauth.id')}</Text>
                  <p className="text-sm font-mono break-all">{selectedProvider.id}</p>
                </div>
                <div className="space-y-2">
                  <Text as="div" variant="label" tone="muted" className="text-xs">{t('oauth.appId')}</Text>
                  <p className="text-sm font-mono break-all">{selectedProvider.app_id}</p>
                </div>
                <div className="space-y-2">
                  <Text as="div" variant="label" tone="muted" className="text-xs">{t('oauth.tableProvider')}</Text>
                  <div className="flex items-center gap-2">
                    <OAuthProviderLogo provider={selectedProvider.provider} size={28} className="rounded" />
                    <span className="text-sm font-semibold capitalize">{selectedProvider.provider}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Text as="div" variant="label" tone="muted" className="text-xs">{t('oauth.tableState')}</Text>
                  <Badge variant={selectedProvider.enabled ? 'tonal' : 'outline'} tone={selectedProvider.enabled ? 'success' : 'neutral'}>
                    {selectedProvider.enabled ? t('oauth.enabled') : t('oauth.disabled')}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Text as="div" variant="label" tone="muted" className="text-xs">{t('oauth.tableName')}</Text>
                <p className="text-sm">{selectedProvider.name || '—'}</p>
              </div>

              <div className="space-y-2">
                <Text as="div" variant="label" tone="muted" className="text-xs">{t('oauth.tableClientId')}</Text>
                <p className="text-sm font-mono break-all bg-muted/50 rounded-lg p-3">{selectedProvider.client_id}</p>
              </div>

              <div className="space-y-2">
                <Text as="div" variant="label" tone="muted" className="text-xs">{t('oauth.callbackKey')}</Text>
                <div className="flex gap-2 items-start">
                  <p className="text-sm font-mono break-all bg-muted/50 rounded-lg p-3 flex-1 min-w-0">{selectedProvider.callback_key}</p>
                  <IconButton
                    icon={Copy}
                    label={t('common.copy')}
                    variant="secondary"
                    className="shrink-0 h-9 w-9"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedProvider.callback_key);
                      showNotification(t('oauth.callbackKeyCopied'), 'success');
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Text as="div" variant="label" tone="muted" className="text-xs">{t('oauth.callbackUri')}</Text>
                <div className="flex gap-2 items-start">
                  <p className="text-sm font-mono break-all bg-muted/50 rounded-lg p-3 flex-1 min-w-0">{selectedProvider.callback_uri}</p>
                  <IconButton
                    icon={Copy}
                    label={t('common.copy')}
                    variant="secondary"
                    className="shrink-0 h-9 w-9"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedProvider.callback_uri);
                      showNotification(t('oauth.callbackUriCopied'), 'success');
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Text as="div" variant="label" tone="muted" className="text-xs">{t('oauth.scopes')}</Text>
                <p className="text-sm font-mono">{selectedProvider.scopes || '—'}</p>
              </div>

              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Text as="div" variant="label" tone="muted" className="text-xs flex items-center gap-1.5">
                    {t('oauth.detailsRedirects')}
                    <FieldHint text={t('oauth.hints.detailsRedirects')} />
                  </Text>
                  {selectedProvider.redirects && selectedProvider.redirects.length > 0 && (
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {selectedProvider.redirects.length}
                    </Badge>
                  )}
                </div>

                {selectedProvider.redirects && selectedProvider.redirects.length > 0 ? (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {selectedProvider.redirects.map((row, idx) => {
                      const rowKey = `${row.platform}-${row.url}`;
                      const isLoading = rowLinkLoadingKey === rowKey;
                      return (
                        <div
                          key={`${rowKey}-${idx}`}
                          className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge variant="tonal" tone="neutral" className="capitalize text-xs shrink-0">
                                {row.platform}
                              </Badge>
                              {row.name?.trim() && (
                                <span className="text-xs text-muted-foreground truncate">{row.name}</span>
                              )}
                              {row.legacy && (
                                <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300">
                                  legacy
                                </Badge>
                              )}
                            </div>
                            {row.rt && (
                              <span className="text-[10px] font-mono text-muted-foreground/70 shrink-0">
                                rt: {row.rt.slice(0, 6)}…
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2 items-start">
                            <p className="text-xs font-mono break-all bg-background rounded-md p-2 flex-1 min-w-0">
                              {row.url}
                            </p>
                            <IconButton
                              icon={Copy}
                              label={t('common.copy')}
                              variant="secondary"
                              className="shrink-0 h-8 w-8"
                              onClick={() => {
                                navigator.clipboard.writeText(row.url);
                                showNotification(t('oauth.redirectUriCopied'), 'success');
                              }}
                            />
                            <IconButton
                              icon={Link2}
                              label={
                                savedPublishableKey
                                  ? t('oauth.copyOAuthLink')
                                  : t('oauth.publishableKeyRequiredForCopy')
                              }
                              variant="secondary"
                              className="shrink-0 h-8 w-8"
                              loading={isLoading}
                              disabled={isLoading || !savedPublishableKey}
                              onClick={() => handleCopyLinkForRedirectRow(row)}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    {t('oauth.detailsRedirectsEmpty')}
                  </p>
                )}

                {(selectedProvider.redirect_uri_web ||
                  selectedProvider.redirect_uri_android ||
                  selectedProvider.redirect_uri_ios ||
                  selectedProvider.redirect_uri_desktop) &&
                  (!selectedProvider.redirects || selectedProvider.redirects.length === 0) && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                      <p className="text-xs text-amber-300 font-medium">
                        {t('oauth.legacyValues')}
                      </p>
                      <p className="text-[11px] text-amber-200/80">
                        {t('oauth.detailsRedirectsLegacyOnly')}
                      </p>
                      <div className="space-y-1.5 pt-1">
                        {[
                          { key: 'web', label: t('oauth.redirectWebLabel'), value: selectedProvider.redirect_uri_web },
                          { key: 'android', label: t('oauth.android'), value: selectedProvider.redirect_uri_android },
                          { key: 'ios', label: t('oauth.ios'), value: selectedProvider.redirect_uri_ios },
                          { key: 'desktop', label: t('oauth.desktop'), value: selectedProvider.redirect_uri_desktop },
                        ]
                          .filter((r) => r.value?.trim())
                          .map((r) => (
                            <div key={r.key} className="flex gap-2 items-center">
                              <span className="text-[10px] uppercase tracking-wide text-amber-200/60 w-16 shrink-0">
                                {r.label}
                              </span>
                              <p className="text-xs font-mono break-all bg-background/60 rounded p-1.5 flex-1 min-w-0">
                                {r.value}
                              </p>
                              <IconButton
                                icon={Copy}
                                label={t('common.copy')}
                                variant="ghost"
                                className="shrink-0 h-7 w-7"
                                onClick={() => {
                                  navigator.clipboard.writeText(r.value!);
                                  showNotification(t('oauth.redirectUriCopied'), 'success');
                                }}
                              />
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
              </div>

              <OAuthNativeAudiences
                key={selectedProvider.id}
                configId={selectedProvider.id}
                provider={selectedProvider.provider}
              />

              <DialogFooter className="pt-4 gap-2 flex-wrap">
                <Button
                  variant="primary"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    if (selectedProvider) {
                      setLinkDialogProvider(selectedProvider);
                      setLinkPlatform('web');
                      setLinkRole(roles.length > 0 ? roles[0].name : 'default');
                      setLinkRedirectUrl('');
                      setLinkRt('');
                      setLinkResult(null);
                    }
                  }}
                >
                  <Link2 className="w-4 h-4" />
                  {t('oauth.fetchLink')}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="secondary" size="sm" className="gap-2">
                        <MoreVertical className="w-4 h-4" />
                        {t('oauth.options')}
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="min-w-[160px]">
                    <DropdownMenuItem icon={Pencil} onClick={() => selectedProvider && openEditModal(selectedProvider)}>
                      {t('oauth.editProvider')}
                    </DropdownMenuItem>
                    {selectedProvider?.enabled ? (
                      <DropdownMenuItem
                        onClick={handleDisableProvider}
                        disabled={!!actionLoading}
                        className="text-amber-600"
                      >
                        <span className="inline-flex items-center gap-2">
                          {actionLoading === 'disable' ? <Spinner size={16} label={null} /> : <Icon icon={PowerOff} size={16} />}
                          {actionLoading === 'disable' ? t('oauth.disabling') : t('oauth.disableProvider')}
                        </span>
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={handleEnableProvider}
                        disabled={!!actionLoading}
                        className="text-emerald-600"
                      >
                        <span className="inline-flex items-center gap-2">
                          {actionLoading === 'enable' ? <Spinner size={16} label={null} /> : <Icon icon={Power} size={16} />}
                          {actionLoading === 'enable' ? t('oauth.enabling') : t('oauth.enableProvider')}
                        </span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      destructive
                      onClick={handleDeleteProvider}
                      disabled={!!actionLoading}
                    >
                      <span className="inline-flex items-center gap-2">
                        {actionLoading === 'delete' ? <Spinner size={16} label={null} /> : <Icon icon={Trash2} size={16} />}
                        {actionLoading === 'delete' ? t('oauth.deleting') : t('oauth.deleteProvider')}
                      </span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!linkDialogProvider}
        onOpenChange={(open) => {
          if (!open) {
            setLinkDialogProvider(null);
            setLinkRedirectUrl('');
            setLinkRt('');
            setLinkRedirectOptions([]);
            setLinkLegacyDeprecation(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-accent" />
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
              <FormField label={t('oauth.platformLabel')}>
                <div className="flex flex-wrap gap-2">
                  {OAUTH_PLATFORMS.map((pl) => (
                    <Button
                      key={pl.value}
                      type="button"
                      variant={linkPlatform === pl.value ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => setLinkPlatform(pl.value)}
                    >
                      {pl.label}
                    </Button>
                  ))}
                </div>
              </FormField>

              <FormField label={t('oauth.roleLabel')}>
                <Select
                  value={linkRole}
                  onValueChange={(v) => setLinkRole(v ?? 'default')}
                  className="w-full h-9"
                  items={
                    roles.length === 0
                      ? [{ value: 'default', label: 'default' }]
                      : roles.map((r) => ({
                          value: r.name,
                          label: `${r.name}${r.description ? ` — ${r.description}` : ''}`,
                        }))
                  }
                />
              </FormField>

              <div className="space-y-2">
                <Text as="span" variant="label">{t('oauth.linkRedirectPick')}</Text>
                {linkLegacyDeprecation?.active && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 space-y-1">
                    <p className="font-semibold">
                      {t('oauth.redirectsLegacyDeprecationTitle', {
                        version: linkLegacyDeprecation.deprecation_version || '1.0.0',
                      })}
                    </p>
                    <p className="text-amber-100/90 leading-relaxed">{linkLegacyDeprecation.message}</p>
                  </div>
                )}
                {!savedSecretKey ? (
                  <p className="text-sm text-amber-400">{t('oauth.secretKeyRequiredForRedirects')}</p>
                ) : linkRedirectsLoading ? (
                  <p className="text-sm text-muted-foreground">{t('oauth.linkRedirectsLoading')}</p>
                ) : linkRedirectsForPlatform.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('oauth.noRedirectsForPlatform')}</p>
                ) : (
                  <Select
                    value={linkRedirectUrl || linkRedirectsForPlatform[0]?.url || ''}
                    onValueChange={(v) => setLinkRedirectUrl(v ?? '')}
                    className="w-full h-9 font-mono text-sm"
                    items={linkRedirectsForPlatform.map((r) => ({
                      value: r.url,
                      label: (
                        <span className="font-mono text-xs">
                          {r.name ? `${r.name} — ${r.url}` : r.url}
                        </span>
                      ),
                    }))}
                  />
                )}
              </div>

              <FormField
                label={
                  <>
                    {t('oauth.linkRtOptional')}
                    <FieldHint text={t('oauth.hints.linkRtField')} />
                  </>
                }
                description={
                  linkRedirectsForPlatform.length > 0 ? t('oauth.linkRtDisabledWhenRedirect') : undefined
                }
              >
                <Input
                  placeholder={t('oauth.linkRtPlaceholder')}
                  value={linkRt}
                  onChange={(e) => setLinkRt(e.target.value)}
                  disabled={linkRedirectsForPlatform.length > 0}
                  className="font-mono text-sm disabled:opacity-60"
                />
              </FormField>

              {!savedPublishableKey && (
                <p className="text-sm text-amber-400">{t('oauth.publishableKeyRequired')}</p>
              )}
              <DialogFooter className="gap-4 justify-between">
                <Button variant="secondary" onClick={() => setLinkDialogProvider(null)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleFetchOAuthLink}
                  disabled={
                    linkLoading ||
                    !savedPublishableKey ||
                    linkRedirectsLoading ||
                    !savedSecretKey ||
                    linkRedirectsForPlatform.length === 0
                  }
                  className="gap-2"
                >
                  {linkLoading && <Spinner size={16} label={null} />}
                  {linkLoading ? t('oauth.fetchingLink') : t('oauth.fetchLink')}
                </Button>
              </DialogFooter>

              {linkResult && (
                <div className="space-y-2 pt-2 border-t">
                  <Text as="div" variant="label" tone="muted" className="text-xs">{t('oauth.resultLink')}</Text>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={linkResult}
                      wrapperClassName="flex-1 min-w-0"
                      className="font-mono text-xs"
                    />
                    <IconButton
                      icon={Copy}
                      label={t('oauth.copyUri')}
                      variant="secondary"
                      onClick={handleCopyLink}
                    />
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
