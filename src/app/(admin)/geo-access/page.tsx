'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Card, CardBody, Radio, RadioGroup, Text } from '@foundathyon/community-ui';
import { Badge } from '@/components/fdn/badge';
import { Button } from '@/components/fdn/button';
import { RichMessage } from '@/components/security-screen/rich-message';
import { SaveFooter } from '@/components/security-screen/save-footer';
import { ResultCard, ScreenNotes, SectionHeading } from '@/components/security-screen/screen-parts';
import { ScreenLoadError, ScreenLoading, ScreenUnavailable } from '@/components/security-screen/screen-states';
import { SecurityScreen } from '@/components/security-screen/security-screen';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning';
import { apiError, type Envelope } from '@/lib/api-envelope';
import {
  COUNTRY_PRESETS,
  INVALID_GEO_CONFIG_SCOPE,
  defaultGeoAccessConfig,
  geoAccessSummary,
  geoAccessWarnings,
  normalizeGeoAccessConfig,
  parseGeoAccessFieldErrors,
  sameGeoAccessConfig,
  toGeoAccessRequest,
  validateGeoAccessConfig,
  type GeoAccessConfig,
  type GeoAccessIssue,
  type GeoAccessMode,
  type UnknownCountryPolicy,
} from '@/lib/geo-access';
import { buildAdminHref, cn } from '@/lib/utils';
import { CountryPicker } from './_components/country-picker';

const MODES: GeoAccessMode[] = ['off', 'allowlist', 'blocklist'];
const UNKNOWN_OPTIONS: UnknownCountryPolicy[] = ['allow', 'deny'];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <Text variant="body-sm" as="p" className="text-danger">{message}</Text>;
}

function GeoAccessEditor({ secretKey }: { secretKey: string }) {
  const { apiUrl, showNotification } = useAdmin();
  const { locale, t } = useI18n();

  const [saved, setSaved] = useState<GeoAccessConfig | null>(null);
  const [draft, setDraftState] = useState<GeoAccessConfig>(defaultGeoAccessConfig);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverErrors, setServerErrors] = useState<GeoAccessIssue[]>([]);

  // A 422's errors refer to the config that was sent: editing voids them.
  const setDraft = (updater: (c: GeoAccessConfig) => GeoAccessConfig) => {
    setDraftState(updater);
    setServerErrors([]);
  };

  const apply = useCallback((c: GeoAccessConfig) => {
    setSaved(c);
    setDraftState(c);
    setServerErrors([]);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(apiUrl('/api/geo-access'), {
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
        setLoadError(apiError(json)?.message || t('geoAccess.loadFailed', { status: res.status }));
        return;
      }
      setUnavailable(false);
      apply(normalizeGeoAccessConfig(json?.data));
    } catch {
      setLoadError(t('securityScreens.networkError'));
    } finally {
      setLoading(false);
    }
  }, [apiUrl, apply, secretKey, t]);

  useEffect(() => {
    load();
  }, [load]);

  const issues = validateGeoAccessConfig(draft, t);
  const dirty = saved ? !sameGeoAccessConfig(draft, saved) : false;
  useUnsavedChangesWarning(dirty);

  const save = async () => {
    if (!saved || saving) return;
    if (issues.length > 0) {
      showNotification(t('geoAccess.reviewFields'), 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(apiUrl('/api/geo-access'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Secret-API-Key': secretKey },
        body: JSON.stringify(toGeoAccessRequest(draft)),
      });
      if (res.status === 404) {
        setUnavailable(true);
        showNotification(t('geoAccess.unsupportedInstance'), 'error');
        return;
      }
      const json = (await res.json().catch(() => null)) as Envelope | null;
      if (!res.ok) {
        const err = apiError(json);
        const fieldErrors =
          res.status === 422 || err?.scope === INVALID_GEO_CONFIG_SCOPE ? parseGeoAccessFieldErrors(err?.message ?? '') : [];
        if (fieldErrors.length > 0) {
          setServerErrors(fieldErrors);
          showNotification(t('geoAccess.rejected'), 'error');
        } else {
          showNotification(err?.message || t('geoAccess.saveFailed', { status: res.status }), 'error');
        }
        return;
      }
      const data = json?.data;
      if (data && typeof data === 'object' && 'config' in data) apply(normalizeGeoAccessConfig(data));
      else await load();
      showNotification(t('securityScreens.saved'), 'success');
    } catch {
      showNotification(t('securityScreens.networkError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ScreenLoading />;
  if (unavailable) return <ScreenUnavailable title={t('geoAccess.unsupportedInstance')} body={t('geoAccess.proOnlyDesc')} />;
  if (loadError || !saved) return <ScreenLoadError message={loadError} onRetry={load} />;

  // Visible errors by field: the client's and, over them, the 422's.
  const errors: Record<string, string> = {};
  for (const i of issues) errors[i.field] ??= i.message;
  for (const e of serverErrors) errors[e.field] = e.message;

  const countryErrors: Record<number, string> = {};
  for (const [field, message] of Object.entries(errors)) {
    const m = /^countries\[(\d+)\]$/.exec(field);
    if (m) countryErrors[Number(m[1])] = message;
  }

  const active = saved.mode !== 'off';
  const countryCount = draft.countries.length > 0 ? ` (${draft.countries.length})` : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Badge tone={active ? 'success' : 'neutral'}>{active ? t('geoAccess.active') : t('geoAccess.inactive')}</Badge>
      </div>

      <Card>
        <CardBody className="space-y-3">
          <SectionHeading id="geo-mode-label" title={t('geoAccess.rule.title')} description={t('geoAccess.rule.description')} />
          <RadioGroup
            aria-labelledby="geo-mode-label"
            value={draft.mode}
            onValueChange={(v) => setDraft((c) => ({ ...c, mode: v as GeoAccessMode }))}
            disabled={saving}
          >
            {MODES.map((m) => (
              <Radio key={m} value={m} label={t(`geoAccess.modes.${m}.label`)} description={t(`geoAccess.modes.${m}.description`)} />
            ))}
          </RadioGroup>
          <FieldError message={errors.mode} />
        </CardBody>
      </Card>

      <Card className={cn(draft.mode === 'off' && 'opacity-70')}>
        <CardBody className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <SectionHeading
              title={`${draft.mode === 'blocklist' ? t('geoAccess.countries.blocked') : t('geoAccess.countries.allowed')}${countryCount}`}
              description={
                draft.mode === 'off'
                  ? t('geoAccess.countries.offHint')
                  : draft.mode === 'allowlist'
                    ? t('geoAccess.countries.allowHint')
                    : t('geoAccess.countries.blockHint')
              }
            />
            <div className="flex flex-wrap gap-1.5">
              {COUNTRY_PRESETS.map((p) => (
                <Button
                  key={p.id}
                  variant="secondary"
                  size="xs"
                  onClick={() =>
                    setDraft((c) => ({
                      ...c,
                      // A preset is a list of allowed countries: if the rule is off, it turns it on.
                      mode: c.mode === 'off' ? 'allowlist' : c.mode,
                      countries: [...p.countries],
                    }))
                  }
                  disabled={saving}
                >
                  {t(`geoAccess.presets.${p.id}`)}
                </Button>
              ))}
            </div>
          </div>
          <CountryPicker
            value={draft.countries}
            onChange={(next) => setDraft((c) => ({ ...c, countries: next }))}
            errors={countryErrors}
            invalid={Boolean(errors.countries)}
            disabled={saving}
          />
          <FieldError message={errors.countries} />
          {Object.entries(countryErrors).map(([i, message]) => (
            <FieldError key={i} message={`${draft.countries[Number(i)] ?? `#${Number(i) + 1}`}: ${message}`} />
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <SectionHeading id="geo-unknown-label" title={t('geoAccess.unknown.title')} description={t('geoAccess.unknown.description')} />
          <RadioGroup
            aria-labelledby="geo-unknown-label"
            value={draft.unknown_country}
            onValueChange={(v) => setDraft((c) => ({ ...c, unknown_country: v as UnknownCountryPolicy }))}
            disabled={saving || draft.mode === 'off'}
          >
            {UNKNOWN_OPTIONS.map((o) => (
              <Radio
                key={o}
                value={o}
                label={t(`geoAccess.unknownOptions.${o}.label`)}
                description={t(`geoAccess.unknownOptions.${o}.description`)}
              />
            ))}
          </RadioGroup>
          <FieldError message={errors.unknown_country} />
        </CardBody>
      </Card>

      <ResultCard>{geoAccessSummary(draft, { locale, t })}</ResultCard>

      {geoAccessWarnings(draft, t).map((w) => (
        <Alert key={w.message} tone={w.tone} title={w.message} />
      ))}

      <ScreenNotes
        notes={[
          <RichMessage key="login" text={t('geoAccess.notes.loginOnly')} />,
          t('geoAccess.notes.testers'),
          <RichMessage
            key="blocked"
            text={t('geoAccess.notes.blocked')}
            link={(content) => (
              <Link href={buildAdminHref('/access-log')} className="text-accent hover:underline">
                {content}
              </Link>
            )}
          />,
        ]}
      />

      <SaveFooter dirty={dirty} saving={saving} onDiscard={() => apply(saved)} onSave={save} />
    </div>
  );
}

export default function GeoAccessPage() {
  const { t } = useI18n();
  return (
    <SecurityScreen
      title={t('geoAccess.title')}
      description={t('geoAccess.description')}
      proOnlyDescription={t('geoAccess.proOnlyDesc')}
    >
      {(secretKey) => <GeoAccessEditor key={secretKey} secretKey={secretKey} />}
    </SecurityScreen>
  );
}
