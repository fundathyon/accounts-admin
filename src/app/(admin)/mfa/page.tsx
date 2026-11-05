'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Card, CardBody, Checkbox, Radio, RadioGroup, Text } from '@foundathyon/community-ui';
import { Badge } from '@/components/fdn/badge';
import { ResultCard, ScreenNotes, SectionHeading } from '@/components/security-screen/screen-parts';
import { SaveFooter } from '@/components/security-screen/save-footer';
import { ScreenLoadError, ScreenLoading, ScreenUnavailable } from '@/components/security-screen/screen-states';
import { SecurityScreen } from '@/components/security-screen/security-screen';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning';
import { apiError, type Envelope } from '@/lib/api-envelope';
import type { Translate } from '@/lib/i18n/types';
import {
  ALL_MFA_FLOWS,
  DEFAULT_MFA_MODE,
  MFA_MODES,
  mfaErrorMessage,
  mfaSummary,
  normalizeMfa,
  sortFlows,
  type MfaConfig,
  type MfaFlow,
  type MfaMode,
} from '@/lib/mfa';

type Draft = { mode: MfaMode; flows: MfaFlow[] };

const STATUS_TONE: Record<MfaMode, 'neutral' | 'success' | 'info'> = {
  off: 'neutral',
  optional: 'success',
  required: 'info',
};

function sameFlows(a: MfaFlow[], b: MfaFlow[]) {
  return a.length === b.length && a.every((f, i) => f === b[i]);
}

function scopedMessage(t: Translate, json: Envelope | null, fallback: string) {
  const err = apiError(json);
  return mfaErrorMessage(t, err?.scope ?? '') || err?.message || fallback;
}

function MfaEditor({ secretKey }: { secretKey: string }) {
  const { apiUrl, showNotification } = useAdmin();
  const { t } = useI18n();

  const [saved, setSaved] = useState<MfaConfig | null>(null);
  const [draft, setDraft] = useState<Draft>({ mode: DEFAULT_MFA_MODE, flows: [...ALL_MFA_FLOWS] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);

  const apply = useCallback((c: MfaConfig) => {
    setSaved(c);
    setDraft({ mode: c.mode, flows: [...c.flows] });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(apiUrl('/api/mfa'), {
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
        setLoadError(scopedMessage(t, json, t('mfa.loadFailed', { status: res.status })));
        return;
      }
      setUnavailable(false);
      apply(normalizeMfa(json));
    } catch {
      setLoadError(t('securityScreens.networkError'));
    } finally {
      setLoading(false);
    }
  }, [apiUrl, apply, secretKey, t]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = saved ? draft.mode !== saved.mode || !sameFlows(draft.flows, saved.flows) : false;
  const noFlows = draft.mode !== 'off' && draft.flows.length === 0;
  useUnsavedChangesWarning(dirty);

  const toggleFlow = (flow: MfaFlow, checked: boolean) =>
    setDraft((d) => ({
      ...d,
      flows: sortFlows(checked ? [...d.flows, flow] : d.flows.filter((f) => f !== flow)),
    }));

  const save = async () => {
    if (!saved || saving || noFlows) return;
    setSaving(true);
    try {
      const res = await fetch(apiUrl('/api/mfa'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Secret-API-Key': secretKey },
        body: JSON.stringify({ mode: draft.mode, flows: draft.flows }),
      });
      if (res.status === 404) {
        setUnavailable(true);
        showNotification(t('mfa.unsupportedInstance'), 'error');
        return;
      }
      const json = (await res.json().catch(() => null)) as Envelope | null;
      if (!res.ok) {
        showNotification(scopedMessage(t, json, t('mfa.saveFailed', { status: res.status })), 'error');
        return;
      }
      apply(json?.data ? normalizeMfa(json) : { ...saved, mode: draft.mode, flows: [...draft.flows] });
      showNotification(t('securityScreens.saved'), 'success');
    } catch {
      showNotification(t('securityScreens.networkError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ScreenLoading />;
  if (unavailable) return <ScreenUnavailable title={t('mfa.upgrade.title')} body={t('mfa.upgrade.body')} />;
  if (loadError || !saved) return <ScreenLoadError message={loadError} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Badge tone={STATUS_TONE[saved.mode]}>{t(`mfa.modes.${saved.mode}.label`)}</Badge>
      </div>

      <Card>
        <CardBody className="space-y-3">
          <SectionHeading id="mfa-mode-label" title={t('mfa.when.title')} description={t('mfa.when.description')} />
          <RadioGroup
            aria-labelledby="mfa-mode-label"
            value={draft.mode}
            onValueChange={(v) => setDraft((d) => ({ ...d, mode: v as MfaMode }))}
            disabled={saving}
          >
            {MFA_MODES.map((m) => {
              const label = t(`mfa.modes.${m.value}.label`);
              return (
                <Radio
                  key={m.value}
                  value={m.value}
                  label={m.recommended ? t('mfa.recommendedLabel', { label }) : label}
                  description={t(`mfa.modes.${m.value}.description`)}
                />
              );
            })}
          </RadioGroup>
          {draft.mode === 'required' && saved.mode !== 'required' && (
            <Alert tone="warning" title={t('mfa.when.requiredWarning')} />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <SectionHeading
            id="mfa-flows-label"
            title={t('mfa.flows.title')}
            description={draft.mode === 'off' ? t('mfa.flows.offHint') : t('mfa.flows.onHint')}
          />
          <div role="group" aria-labelledby="mfa-flows-label" className="space-y-2">
            {ALL_MFA_FLOWS.map((flow) => (
              <Checkbox
                key={flow}
                label={t(`mfa.flows.${flow}.label`)}
                description={t(`mfa.flows.${flow}.description`)}
                checked={draft.flows.includes(flow)}
                disabled={saving || draft.mode === 'off'}
                onCheckedChange={(checked) => toggleFlow(flow, checked === true)}
              />
            ))}
          </div>
          {noFlows && <Text variant="body-sm" as="p" className="text-danger">{t('mfa.flows.none')}</Text>}
        </CardBody>
      </Card>

      <ResultCard>{mfaSummary(t, draft.mode, draft.flows)}</ResultCard>
      <ScreenNotes notes={[t('mfa.notes.optional'), t('mfa.notes.unchecked')]} />

      <SaveFooter dirty={dirty} saving={saving} canSave={!noFlows} onDiscard={() => apply(saved)} onSave={save} />
    </div>
  );
}

export default function MfaPage() {
  const { t } = useI18n();
  return (
    <SecurityScreen title={t('mfa.title')} description={t('mfa.description')}>
      {(secretKey) => <MfaEditor key={secretKey} secretKey={secretKey} />}
    </SecurityScreen>
  );
}
