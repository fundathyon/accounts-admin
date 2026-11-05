'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardBody, Radio, RadioGroup } from '@foundathyon/community-ui';
import { Badge } from '@/components/fdn/badge';
import { ResultCard, ScreenNotes, SectionHeading } from '@/components/security-screen/screen-parts';
import { SaveFooter } from '@/components/security-screen/save-footer';
import { ScreenLoadError, ScreenLoading, ScreenUnavailable } from '@/components/security-screen/screen-states';
import { SecurityScreen } from '@/components/security-screen/security-screen';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning';
import { apiError, type Envelope } from '@/lib/api-envelope';
import {
  DEFAULT_IDENTITY_LINKING_MODE,
  IDENTITY_LINKING_MODES,
  identityLinkingSummary,
  normalizeIdentityLinking,
  type IdentityLinkingConfig,
  type IdentityLinkingMode,
} from '@/lib/identity-linking';

function IdentityLinkingEditor({ secretKey }: { secretKey: string }) {
  const { apiUrl, showNotification } = useAdmin();
  const { t } = useI18n();

  const [saved, setSaved] = useState<IdentityLinkingConfig | null>(null);
  const [draft, setDraft] = useState<IdentityLinkingMode>(DEFAULT_IDENTITY_LINKING_MODE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);

  const apply = useCallback((c: IdentityLinkingConfig) => {
    setSaved(c);
    setDraft(c.mode);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(apiUrl('/api/identity-linking'), {
        headers: { 'X-Secret-API-Key': secretKey },
        cache: 'no-store',
      });
      if (res.status === 404) {
        setUnavailable(true);
        setSaved(null);
        return;
      }
      const json = (await res.json().catch(() => null)) as Envelope | null;
      if (!res.ok) {
        setLoadError(apiError(json)?.message || t('identityLinking.loadFailed', { status: res.status }));
        return;
      }
      setUnavailable(false);
      apply(normalizeIdentityLinking(json));
    } catch {
      setLoadError(t('securityScreens.networkError'));
    } finally {
      setLoading(false);
    }
  }, [apiUrl, apply, secretKey, t]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = saved ? draft !== saved.mode : false;
  useUnsavedChangesWarning(dirty);

  const save = async () => {
    if (!saved || saving) return;
    setSaving(true);
    try {
      const res = await fetch(apiUrl('/api/identity-linking'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Secret-API-Key': secretKey },
        body: JSON.stringify({ mode: draft }),
      });
      if (res.status === 404) {
        setUnavailable(true);
        showNotification(t('identityLinking.unsupportedInstance'), 'error');
        return;
      }
      const json = (await res.json().catch(() => null)) as Envelope | null;
      if (!res.ok) {
        showNotification(apiError(json)?.message || t('identityLinking.saveFailed', { status: res.status }), 'error');
        return;
      }
      apply(json?.data ? normalizeIdentityLinking(json) : { mode: draft, updated_at: saved.updated_at });
      showNotification(t('securityScreens.saved'), 'success');
    } catch {
      showNotification(t('securityScreens.networkError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ScreenLoading />;
  if (unavailable) {
    return <ScreenUnavailable title={t('identityLinking.upgrade.title')} body={t('identityLinking.upgrade.body')} />;
  }
  if (loadError || !saved) return <ScreenLoadError message={loadError} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Badge tone={saved.mode === 'separate' ? 'neutral' : 'success'}>
          {t(`identityLinking.modes.${saved.mode}.label`)}
        </Badge>
      </div>

      <Card>
        <CardBody className="space-y-3">
          <SectionHeading
            id="identity-linking-mode-label"
            title={t('identityLinking.mode.title')}
            description={t('identityLinking.mode.description')}
          />
          <RadioGroup
            aria-labelledby="identity-linking-mode-label"
            value={draft}
            onValueChange={(v) => setDraft(v as IdentityLinkingMode)}
            disabled={saving}
          >
            {IDENTITY_LINKING_MODES.map((m) => {
              const label = t(`identityLinking.modes.${m.value}.label`);
              return (
                <Radio
                  key={m.value}
                  value={m.value}
                  label={m.recommended ? t('identityLinking.recommendedLabel', { label }) : label}
                  description={t(`identityLinking.modes.${m.value}.description`)}
                />
              );
            })}
          </RadioGroup>
        </CardBody>
      </Card>

      <ResultCard>{identityLinkingSummary(t, draft)}</ResultCard>
      <ScreenNotes notes={[t('identityLinking.notes.proof'), t('identityLinking.notes.separate')]} />

      <SaveFooter dirty={dirty} saving={saving} onDiscard={() => apply(saved)} onSave={save} />
    </div>
  );
}

export default function IdentityLinkingPage() {
  const { t } = useI18n();
  return (
    <SecurityScreen title={t('identityLinking.title')} description={t('identityLinking.description')}>
      {(secretKey) => <IdentityLinkingEditor key={secretKey} secretKey={secretKey} />}
    </SecurityScreen>
  );
}
