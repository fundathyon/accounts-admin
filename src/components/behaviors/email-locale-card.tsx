'use client';

import { useCallback, useEffect, useState } from 'react';
import { Languages } from 'lucide-react';
import { Alert, FormField, Input } from '@foundathyon/community-ui';
import { SaveFooter } from '@/components/security-screen/save-footer';
import { ScreenLoadError, ScreenLoading } from '@/components/security-screen/screen-states';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning';
import { apiError, type Envelope } from '@/lib/api-envelope';

interface EmailLocale {
  default_locale?: string;
  effective_default_locale?: string;
  updated_at?: string;
}

// `emaillocale.Normalize`: the backend lowercases and turns `_` into `-` before checking.
const LOCALE_SHAPE = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/;
const LOCALE_MAX_LENGTH = 35;

function isLocale(value: string): boolean {
  const locale = value.trim().toLowerCase().replaceAll('_', '-');
  return locale === '' || (locale.length <= LOCALE_MAX_LENGTH && LOCALE_SHAPE.test(locale));
}

/** Default language of the transactional emails: the `email_locale` behavior, Community and Pro. */
export function EmailLocaleCard({ secretKey }: { secretKey: string }) {
  const { apiUrl, showNotification } = useAdmin();
  const { t } = useI18n();
  const [saved, setSaved] = useState<EmailLocale | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);

  const apply = (next: EmailLocale) => {
    setSaved(next);
    setDraft(next.default_locale ?? '');
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(apiUrl('/api/behaviors/email-locale'), {
        headers: { 'X-Secret-API-Key': secretKey },
        cache: 'no-store',
      });
      if (res.status === 404) {
        setUnavailable(true);
        return;
      }
      const json = (await res.json().catch(() => null)) as Envelope | null;
      if (!res.ok) {
        setLoadError(apiError(json)?.message ?? t('behaviors.emailLocale.loadFailed'));
        return;
      }
      apply((json?.data ?? {}) as EmailLocale);
    } catch {
      setLoadError(t('securityScreens.networkError'));
    } finally {
      setLoading(false);
    }
  }, [apiUrl, secretKey, t]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = saved !== null && draft.trim() !== (saved.default_locale ?? '');
  const valid = isLocale(draft);
  useUnsavedChangesWarning(dirty);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(apiUrl('/api/behaviors/email-locale'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Secret-API-Key': secretKey },
        body: JSON.stringify({ default_locale: draft.trim() }),
      });
      const json = (await res.json().catch(() => null)) as Envelope | null;
      if (!res.ok) {
        const error = apiError(json);
        showNotification(
          error?.scope === 'email_locale.invalid_locale'
            ? t('behaviors.emailLocale.invalid')
            : (error?.message ?? t('behaviors.emailLocale.saveFailed')),
          'error',
        );
        return;
      }
      apply((json?.data ?? {}) as EmailLocale);
      showNotification(t('securityScreens.saved'), 'success');
    } catch {
      showNotification(t('securityScreens.networkError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ScreenLoading />;
  if (unavailable) return <Alert tone="warning" title={t('behaviors.emailLocale.unavailable')} />;
  if (loadError || !saved) return <ScreenLoadError message={loadError} onRetry={load} />;

  return (
    <div className="rounded-lg border border-border/60 bg-bg-subtle/30 p-4 space-y-4">
      <div className="flex items-center gap-2 text-body font-semibold text-text">
        <Languages className="w-4 h-4 text-text-muted" />
        {t('behaviors.emailLocale.title')}
      </div>
      <FormField
        label={t('behaviors.emailLocale.label')}
        description={t('behaviors.emailLocale.help', { locale: saved.effective_default_locale ?? 'en' })}
        error={valid ? undefined : t('behaviors.emailLocale.invalid')}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="es-MX"
          className="font-mono"
          wrapperClassName="max-w-xs"
          disabled={saving}
        />
      </FormField>
      <SaveFooter
        dirty={dirty}
        saving={saving}
        canSave={valid}
        onDiscard={() => setDraft(saved.default_locale ?? '')}
        onSave={save}
      />
    </div>
  );
}
