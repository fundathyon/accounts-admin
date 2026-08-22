'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smartphone,
  Plus,
  Copy,
  Trash2,
  Info,
  Check,
} from 'lucide-react';
import {
  Badge,
  Button,
  FormField,
  IconButton,
  Input,
  Select,
  Spinner,
  Text,
  Tooltip,
} from '@foundathyon/community-ui';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { FieldHint } from '@/components/ui/field-hint';
import type { OAuthNativeAudience, OAuthNativePlatform } from '@/lib/admin-types';

interface Props {
  configId: string;
  provider: string;
}

const PLATFORMS: { value: OAuthNativePlatform; label: string }[] = [
  { value: 'ios', label: 'iOS' },
  { value: 'android', label: 'Android' },
  { value: 'web', label: 'Web' },
];

const PLATFORM_ORDER: Record<OAuthNativePlatform, number> = { ios: 0, android: 1, web: 2 };

function audiencePlaceholder(provider: string, platform: OAuthNativePlatform): string {
  const p = provider.toLowerCase();
  if (p === 'apple') {
    if (platform === 'ios') return 'com.yourcompany.yourapp';
    return 'com.yourcompany.yourapp';
  }
  if (p === 'google') {
    if (platform === 'ios') return '123-xxx-ios.apps.googleusercontent.com';
    if (platform === 'android') return '123-xxx-web.apps.googleusercontent.com';
    return '123-xxx-web.apps.googleusercontent.com';
  }
  return 'aud value from id_token JWT';
}

function defaultLabelFor(provider: string, platform: OAuthNativePlatform): string {
  const p = provider.toLowerCase();
  if (p === 'apple' && platform === 'ios') return 'Apple Services ID';
  if (p === 'google' && platform === 'ios') return 'iOS Client ID';
  if (p === 'google' && platform === 'android') return 'Web Client ID (Android backend)';
  return '';
}

export function OAuthNativeAudiences({ configId, provider }: Props) {
  const { savedSecretKey, apiUrl, showNotification } = useAdmin();
  const { t } = useI18n();

  const [audiences, setAudiences] = useState<OAuthNativeAudience[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [formPlatform, setFormPlatform] = useState<OAuthNativePlatform>('ios');
  const [formAudience, setFormAudience] = useState('');
  const [formLabel, setFormLabel] = useState('');

  const fetchAudiences = useCallback(async () => {
    if (!savedSecretKey || !configId) return;
    setLoading(true);
    try {
      const res = await fetch(
        apiUrl(`/api/oauth-configs/${encodeURIComponent(configId)}/audiences`),
        { headers: { 'X-Secret-API-Key': savedSecretKey } }
      );
      const data = await res.json();
      if (data.success) {
        setAudiences(Array.isArray(data.data) ? data.data : []);
      } else {
        showNotification(
          data.error?.message || t('oauth.audiences.errorLoad'),
          'error'
        );
      }
    } catch {
      showNotification(t('oauth.errorConnection'), 'error');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, configId, savedSecretKey, showNotification, t]);

  useEffect(() => {
    fetchAudiences();
  }, [fetchAudiences]);

  const sortedAudiences = useMemo(() => {
    return [...audiences].sort((a, b) => {
      const order = PLATFORM_ORDER[a.platform] - PLATFORM_ORDER[b.platform];
      if (order !== 0) return order;
      return (a.created_at || '').localeCompare(b.created_at || '');
    });
  }, [audiences]);

  const groupedCounts = useMemo(() => {
    const counts: Record<OAuthNativePlatform, number> = { ios: 0, android: 0, web: 0 };
    audiences.forEach((a) => {
      if (a.platform in counts) counts[a.platform] += 1;
    });
    return counts;
  }, [audiences]);

  const resetForm = () => {
    setFormPlatform('ios');
    setFormAudience('');
    setFormLabel('');
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedAudience = formAudience.trim();
    if (!trimmedAudience) {
      showNotification(t('oauth.audiences.audienceRequired'), 'error');
      return;
    }
    if (!savedSecretKey) {
      showNotification(t('oauth.secretKeyRequired'), 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        apiUrl(`/api/oauth-configs/${encodeURIComponent(configId)}/audiences`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Secret-API-Key': savedSecretKey,
          },
          body: JSON.stringify({
            platform: formPlatform,
            audience: trimmedAudience,
            label: formLabel.trim() || defaultLabelFor(provider, formPlatform) || undefined,
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        showNotification(t('oauth.audiences.created'), 'success');
        if (data.data?.id) {
          setAudiences((prev) => [...prev, data.data as OAuthNativeAudience]);
        } else {
          fetchAudiences();
        }
        resetForm();
        setShowAddForm(false);
      } else {
        showNotification(
          data.error?.message || t('oauth.audiences.errorCreate'),
          'error'
        );
      }
    } catch {
      showNotification(t('oauth.errorConnectionServer'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (a: OAuthNativeAudience) => {
    if (!savedSecretKey) return;
    if (!window.confirm(t('oauth.audiences.deleteConfirm'))) return;
    setDeletingId(a.id);
    try {
      const res = await fetch(
        apiUrl(
          `/api/oauth-configs/${encodeURIComponent(configId)}/audiences/${encodeURIComponent(a.id)}`
        ),
        {
          method: 'DELETE',
          headers: { 'X-Secret-API-Key': savedSecretKey },
        }
      );
      if (res.status === 204 || res.ok) {
        showNotification(t('oauth.audiences.deleted'), 'success');
        setAudiences((prev) => prev.filter((x) => x.id !== a.id));
      } else {
        const data = await res.json().catch(() => ({}));
        showNotification(
          data.error?.message || t('oauth.audiences.errorDelete'),
          'error'
        );
      }
    } catch {
      showNotification(t('oauth.errorConnectionServer'), 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopy = async (a: OAuthNativeAudience) => {
    try {
      await navigator.clipboard.writeText(a.audience);
      setCopiedId(a.id);
      setTimeout(() => setCopiedId((id) => (id === a.id ? null : id)), 1500);
      showNotification(t('oauth.audiences.copied'), 'success');
    } catch {
      showNotification(t('oauth.errorConnectionServer'), 'error');
    }
  };

  const providerKey = provider.toLowerCase();
  const showProviderHint = providerKey === 'apple' || providerKey === 'google';

  const placeholder = audiencePlaceholder(provider, formPlatform);

  return (
    <div className="space-y-3 pt-2 border-t">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Text as="div" variant="label" tone="muted" className="text-xs flex items-center gap-1.5">
          <Smartphone className="w-3.5 h-3.5" />
          {t('oauth.audiences.sectionTitle')}
          <FieldHint text={t('oauth.audiences.sectionHint')} />
        </Text>
        <div className="flex items-center gap-2">
          {audiences.length > 0 && (
            <Badge variant="outline" className="text-[10px] font-mono">
              {audiences.length}
            </Badge>
          )}
          <div className="hidden sm:flex items-center gap-1.5">
            {PLATFORMS.map((pl) => {
              const count = groupedCounts[pl.value];
              const active = count > 0;
              return (
                <Tooltip
                  key={pl.value}
                  content={
                    active
                      ? t('oauth.audiences.platformReady', { platform: pl.label })
                      : t('oauth.audiences.platformMissing', { platform: pl.label })
                  }
                >
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      active
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                        : 'border-border/60 bg-muted/30 text-muted-foreground'
                    }`}
                  >
                    {pl.label} · {count}
                  </span>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>

      {showProviderHint && (
        <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 p-3 flex gap-2 items-start text-xs">
          <Info className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <p className="text-sky-200 leading-relaxed">
              {providerKey === 'apple'
                ? t('oauth.audiences.appleHint')
                : t('oauth.audiences.googleHint')}
            </p>
            <p className="text-[11px] text-sky-200/70 leading-relaxed">
              {t('oauth.audiences.audSource')}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-6 flex justify-center">
          <Spinner size={20} label={t('common.loading')} className="text-muted-foreground" />
        </div>
      ) : sortedAudiences.length > 0 ? (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {sortedAudiences.map((a) => (
              <motion.div
                key={a.id}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="tonal" tone="neutral" className="capitalize text-xs shrink-0">
                      {a.platform}
                    </Badge>
                    {a.label?.trim() && (
                      <span className="text-xs text-muted-foreground truncate">
                        {a.label}
                      </span>
                    )}
                  </div>
                  {a.created_at && (
                    <span className="text-[10px] font-mono text-muted-foreground/70 shrink-0">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 items-start">
                  <p className="text-xs font-mono break-all bg-background rounded-md p-2 flex-1 min-w-0">
                    {a.audience}
                  </p>
                  <IconButton
                    icon={copiedId === a.id ? Check : Copy}
                    label={t('oauth.audiences.copy')}
                    variant="secondary"
                    className={`shrink-0 h-8 w-8 ${copiedId === a.id ? 'text-emerald-400' : ''}`}
                    onClick={() => handleCopy(a)}
                  />
                  <IconButton
                    icon={Trash2}
                    label={t('oauth.audiences.delete')}
                    variant="secondary"
                    className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive hover:border-destructive/40"
                    loading={deletingId === a.id}
                    disabled={deletingId === a.id}
                    onClick={() => handleDelete(a)}
                  />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-center">
          <p className="text-xs text-muted-foreground">
            {t('oauth.audiences.empty')}
          </p>
        </div>
      )}

      <AnimatePresence initial={false}>
        {showAddForm ? (
          <motion.form
            key="form"
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            onSubmit={handleAdd}
            className="rounded-lg border border-accent-border bg-accent-bg p-3 space-y-3 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-accent">
                {t('oauth.audiences.addTitle')}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddForm(false);
                  resetForm();
                }}
                className="h-7 px-2 text-xs"
                disabled={submitting}
              >
                {t('common.cancel')}
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-2">
              <FormField
                label={
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t('oauth.audiences.platform')}
                  </span>
                }
              >
                <Select
                  value={formPlatform}
                  onValueChange={(v) => setFormPlatform(v as OAuthNativePlatform)}
                  className="h-9"
                  items={PLATFORMS.map((pl) => ({ value: pl.value, label: pl.label }))}
                />
              </FormField>
              <FormField
                className="min-w-0"
                label={
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    {t('oauth.audiences.audience')}
                    <FieldHint text={t('oauth.audiences.audienceHint')} />
                  </span>
                }
              >
                <Input
                  required
                  value={formAudience}
                  onChange={(e) => setFormAudience(e.target.value)}
                  placeholder={placeholder}
                  wrapperClassName="h-9"
                  className="font-mono text-xs"
                  autoFocus
                />
              </FormField>
            </div>
            <FormField
              label={
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {t('oauth.audiences.label')}
                </span>
              }
            >
              <Input
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder={defaultLabelFor(provider, formPlatform) || '—'}
                wrapperClassName="h-9"
                className="text-xs"
              />
            </FormField>
            <div className="flex justify-end">
              <Button type="submit" variant="primary" size="sm" className="gap-2" disabled={submitting}>
                {submitting && <Spinner size={14} label={null} />}
                {submitting ? t('oauth.audiences.adding') : t('oauth.audiences.add')}
              </Button>
            </div>
          </motion.form>
        ) : (
          <motion.div
            key="trigger"
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2 w-full sm:w-auto"
              onClick={() => setShowAddForm(true)}
              disabled={!savedSecretKey}
            >
              <Plus className="w-4 h-4" />
              {t('oauth.audiences.addCta')}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
