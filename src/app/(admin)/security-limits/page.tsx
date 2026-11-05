'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Card, CardBody, Input, Select, Tab, Tabs, TabsList, TabsPanel, Text } from '@foundathyon/community-ui';
import { Badge } from '@/components/fdn/badge';
import { IconButton } from '@/components/fdn/button';
import { SaveFooter } from '@/components/security-screen/save-footer';
import { ScreenNotes } from '@/components/security-screen/screen-parts';
import { ScreenLoadError, ScreenLoading, ScreenUnavailable } from '@/components/security-screen/screen-states';
import { SecurityScreen } from '@/components/security-screen/security-screen';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning';
import { apiError, type Envelope } from '@/lib/api-envelope';
import { cn } from '@/lib/utils';
import {
  DURATIONS_KEY,
  MAX_DURATIONS,
  SECTIONS,
  TIME_UNITS,
  bestUnit,
  buildPatch,
  changedKeys,
  fieldErrorFromApi,
  formatDurations,
  formatValue,
  normalizeSecurityLimits,
  rangeText,
  scalarDescription,
  scalarLabel,
  sectionDescription,
  sectionTitle,
  securityLimitsErrorMessage,
  unitLabel,
  unitSeconds,
  validateDraft,
  type FieldKey,
  type FieldKind,
  type LimitSection,
  type LimitValues,
  type ScalarField,
  type SecurityLimits,
  type TimeUnit,
} from '@/lib/security-limits';

function toText(value: number, factor: number): string {
  return Number.isFinite(value) ? String(value / factor) : '';
}

function parseText(text: string, factor: number): number {
  if (text.trim() === '') return Number.NaN;
  const n = Number(text);
  return Number.isFinite(n) ? Math.round(n * factor) : Number.NaN;
}

function same(a: number, b: number) {
  return a === b || (Number.isNaN(a) && Number.isNaN(b));
}

/** One field: the number and, for times, its unit. */
function LimitInput({
  id,
  kind,
  value,
  onChange,
  disabled,
  invalid,
  label,
}: {
  id: string;
  kind: FieldKind;
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
  invalid: boolean;
  label: string;
}) {
  const { t } = useI18n();
  const [unit, setUnit] = useState<TimeUnit>(() => (kind === 'seconds' ? bestUnit(value) : 's'));
  const factor = kind === 'seconds' ? unitSeconds(unit) : 1;
  const [text, setText] = useState(() => toText(value, factor));
  const [prev, setPrev] = useState(value);

  // If the value changes from outside (reset, discard, save) the text is
  // rewritten; if it is the echo of what is being typed, it is not.
  if (!same(prev, value)) {
    setPrev(value);
    if (!same(parseText(text, factor), value)) {
      const nextUnit = kind === 'seconds' ? bestUnit(value) : 's';
      setUnit(nextUnit);
      setText(toText(value, kind === 'seconds' ? unitSeconds(nextUnit) : 1));
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        size="sm"
        wrapperClassName="w-24"
        className="tabular-nums"
        value={text}
        disabled={disabled}
        invalid={invalid}
        aria-label={label}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseText(e.target.value, factor));
        }}
      />
      {kind === 'seconds' && (
        <Select
          size="sm"
          className="w-28"
          aria-label={t('securityLimits.unitLabel', { label })}
          items={TIME_UNITS.map((u) => ({ value: u.value, label: unitLabel(t, u.value) }))}
          value={unit}
          disabled={disabled}
          onValueChange={(v) => {
            if (!v) return;
            const next = v as TimeUnit;
            setUnit(next);
            onChange(parseText(text, unitSeconds(next)));
          }}
        />
      )}
    </div>
  );
}

function CustomBadge() {
  const { t } = useI18n();
  return <Badge tone="info">{t('securityLimits.source.custom')}</Badge>;
}

function ResetButton({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
  const { t } = useI18n();
  return (
    <IconButton
      icon={RotateCcw}
      variant="ghost"
      size="xs"
      label={t('securityLimits.reset.aria', { label })}
      disabled={disabled}
      onClick={onClick}
    />
  );
}

function FieldError({ error }: { error: string | undefined }) {
  if (!error) return null;
  return (
    <Text variant="body-sm" as="p" role="alert" className="text-danger sm:col-span-2">
      {error}
    </Text>
  );
}

const ROW = 'grid grid-cols-1 gap-2 border-t border-border py-3 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center';

function ScalarRow({
  field,
  saved,
  draft,
  error,
  disabled,
  onChange,
}: {
  field: ScalarField;
  saved: SecurityLimits;
  draft: LimitValues;
  error: string | undefined;
  disabled: boolean;
  onChange: (v: number | null) => void;
}) {
  const { t } = useI18n();
  const key = field.key;
  const slug = key.replace('.', '-').replace(/_/g, '-');
  const instance = saved.defaults[key] ?? saved.effective[key];
  const custom = draft[key] !== null;
  const shown = draft[key] ?? instance ?? Number.NaN;
  const label = scalarLabel(t, key);
  const range = saved.ranges[key];
  const meta = [
    range ? rangeText(field.kind, range, t) : null,
    t('securityLimits.instance', { value: formatValue(field.kind, instance, t) }),
  ].filter(Boolean);
  return (
    <div className={ROW}>
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <label htmlFor={`limit-${slug}`} className="text-body font-medium">{label}</label>
          {custom && <CustomBadge />}
        </div>
        <Text variant="body-sm" tone="muted" as="p">{scalarDescription(t, key)}</Text>
        <Text variant="caption" tone="muted" as="p">{meta.join(' · ')}</Text>
      </div>
      <div className="flex items-center gap-1 sm:justify-end">
        <LimitInput
          id={`limit-${slug}`}
          kind={field.kind}
          value={shown}
          onChange={onChange}
          disabled={disabled}
          invalid={!!error}
          label={label}
        />
        <span className="flex w-7 justify-center">
          {custom && <ResetButton onClick={() => onChange(null)} disabled={disabled} label={label} />}
        </span>
      </div>
      <FieldError error={error} />
    </div>
  );
}

function DurationsRow({
  saved,
  draft,
  error,
  disabled,
  onChange,
}: {
  saved: SecurityLimits;
  draft: LimitValues;
  error: string | undefined;
  disabled: boolean;
  onChange: (v: number[] | null) => void;
}) {
  const { t } = useI18n();
  const instance = saved.defaults[DURATIONS_KEY] ?? saved.effective[DURATIONS_KEY];
  const custom = draft[DURATIONS_KEY] !== null;
  const list = draft[DURATIONS_KEY] ?? instance ?? [];
  const range = saved.ranges[DURATIONS_KEY];
  const title = t('securityLimits.durations.title');
  const set = (i: number, v: number) => onChange(list.map((d, j) => (j === i ? v : d)));
  const add = () => onChange([...list, list.length ? list[list.length - 1] : (range?.min ?? 60)]);
  const remove = (i: number) => onChange(list.filter((_, j) => j !== i));
  const meta = [
    range ? t('securityLimits.durations.eachStep', { range: rangeText('seconds', range, t).toLowerCase() }) : null,
    t('securityLimits.instance', { value: formatDurations(instance, t) }),
  ].filter(Boolean);
  return (
    <div className="grid grid-cols-1 gap-2 border-t border-border py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <p id="limit-lockout-durations-label" className="text-body font-medium">{title}</p>
          {custom && <CustomBadge />}
        </div>
        <Text variant="body-sm" tone="muted" as="p">
          {t('securityLimits.durations.description', { max: MAX_DURATIONS })}
        </Text>
        <Text variant="caption" tone="muted" as="p">{meta.join(' · ')}</Text>
      </div>
      <div className="flex items-start gap-1 sm:justify-end">
        <ol aria-labelledby="limit-lockout-durations-label" className="space-y-1">
          {list.map((d, i) => {
            const step = t('securityLimits.durations.step', { n: i + 1 });
            return (
              <li key={i} className="flex items-center gap-1">
                <Text variant="caption" tone="muted" className="w-16 shrink-0">{step}</Text>
                <LimitInput
                  id={`limit-lockout-duration-${i + 1}`}
                  kind="seconds"
                  value={d}
                  onChange={(v) => set(i, v)}
                  disabled={disabled}
                  invalid={!!error}
                  label={step}
                />
                <span className="flex w-7 justify-center">
                  {list.length > 1 && (
                    <IconButton
                      icon={Trash2}
                      variant="destructive-subtle"
                      size="xs"
                      label={t('securityLimits.durations.remove', { n: i + 1 })}
                      disabled={disabled}
                      onClick={() => remove(i)}
                    />
                  )}
                </span>
              </li>
            );
          })}
        </ol>
        <span className="flex w-7 flex-col items-center gap-1">
          <IconButton
            icon={Plus}
            variant="ghost"
            size="xs"
            label={t('securityLimits.durations.add')}
            disabled={disabled || list.length >= MAX_DURATIONS}
            onClick={add}
          />
          {custom && <ResetButton onClick={() => onChange(null)} disabled={disabled} label={title} />}
        </span>
      </div>
      <FieldError error={error} />
    </div>
  );
}

function SecurityLimitsEditor({ secretKey }: { secretKey: string }) {
  const { apiUrl, showNotification } = useAdmin();
  const { t } = useI18n();

  const [saved, setSaved] = useState<SecurityLimits | null>(null);
  const [draft, setDraft] = useState<LimitValues | null>(null);
  const [serverErrors, setServerErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<LimitSection>('rate_limit');

  const apply = useCallback((c: SecurityLimits) => {
    setSaved(c);
    setDraft({ ...c.values });
    setServerErrors({});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(apiUrl('/api/security-limits'), {
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
        setLoadError(securityLimitsErrorMessage(t, apiError(json), t('securityLimits.loadFailed', { status: res.status })));
        return;
      }
      setUnavailable(false);
      apply(normalizeSecurityLimits(json));
    } catch {
      setLoadError(t('securityScreens.networkError'));
    } finally {
      setLoading(false);
    }
  }, [apiUrl, apply, secretKey, t]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = saved && draft ? changedKeys(saved.values, draft).length > 0 : false;
  const clientErrors = saved && draft ? validateDraft(draft, saved.ranges, t) : {};
  const hasClientErrors = Object.keys(clientErrors).length > 0;
  useUnsavedChangesWarning(dirty);

  const setField = <K extends FieldKey>(key: K, value: LimitValues[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setServerErrors((e) => {
      if (!(key in e)) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const save = async () => {
    if (!saved || !draft || saving || !dirty || hasClientErrors) return;
    setSaving(true);
    try {
      const res = await fetch(apiUrl('/api/security-limits'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Secret-API-Key': secretKey },
        body: JSON.stringify(buildPatch(saved.values, draft)),
      });
      if (res.status === 404) {
        setUnavailable(true);
        showNotification(t('securityLimits.unsupportedInstance'), 'error');
        return;
      }
      const json = (await res.json().catch(() => null)) as Envelope | null;
      if (!res.ok) {
        const err = apiError(json);
        const onField = fieldErrorFromApi(err, t);
        if (onField) {
          setServerErrors({ [onField.field]: onField.message });
          showNotification(t('securityLimits.reviewFields'), 'error');
        } else {
          showNotification(securityLimitsErrorMessage(t, err, t('securityLimits.saveFailed', { status: res.status })), 'error');
        }
        return;
      }
      if (json?.data) apply(normalizeSecurityLimits(json));
      else await load();
      showNotification(t('securityScreens.saved'), 'success');
    } catch {
      showNotification(t('securityScreens.networkError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ScreenLoading />;
  if (unavailable) return <ScreenUnavailable title={t('securityLimits.upgrade.title')} body={t('securityLimits.upgrade.body')} />;
  if (loadError || !saved || !draft) return <ScreenLoadError message={loadError} onRetry={load} />;

  const customCount = Object.values(draft).filter((v) => v !== null).length;
  const errorFor = (key: FieldKey) => serverErrors[key] ?? clientErrors[key];

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Badge tone={customCount ? 'info' : 'neutral'}>
          {customCount === 0
            ? t('securityLimits.status.allDefault')
            : t(customCount === 1 ? 'securityLimits.status.customOne' : 'securityLimits.status.customMany', { count: customCount })}
        </Badge>
      </div>

      <Card>
        <CardBody>
          <Tabs value={tab} onValueChange={(v) => setTab(v as LimitSection)}>
            <TabsList className="overflow-x-auto overflow-y-hidden">
              {SECTIONS.map((section) => {
                const keys: FieldKey[] = section.fields.map((f) => f.key);
                if (section.durationsAfter) keys.push(DURATIONS_KEY);
                const hasError = keys.some((k) => errorFor(k));
                const hasCustom = keys.some((k) => draft[k] !== null);
                return (
                  <Tab key={section.id} value={section.id} className="shrink-0 whitespace-nowrap">
                    {sectionTitle(t, section.id)}
                    {(hasError || hasCustom) && (
                      <span aria-hidden className={cn('size-1.5 rounded-full', hasError ? 'bg-danger' : 'bg-info')} />
                    )}
                  </Tab>
                );
              })}
            </TabsList>
            {/* Kept mounted: each input remembers its unit and half-typed text. */}
            {SECTIONS.map((section) => (
              <TabsPanel key={section.id} value={section.id} keepMounted className="space-y-3 pt-3">
                <Text variant="body-sm" tone="muted" as="p">{sectionDescription(t, section.id)}</Text>
                <div className="max-w-3xl">
                  {section.fields.map((field) => (
                    <div key={field.key}>
                      <ScalarRow
                        field={field}
                        saved={saved}
                        draft={draft}
                        error={errorFor(field.key)}
                        disabled={saving}
                        onChange={(v) => setField(field.key, v)}
                      />
                      {section.durationsAfter === field.key && (
                        <DurationsRow
                          saved={saved}
                          draft={draft}
                          error={errorFor(DURATIONS_KEY)}
                          disabled={saving}
                          onChange={(v) => setField(DURATIONS_KEY, v)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </TabsPanel>
            ))}
          </Tabs>
        </CardBody>
      </Card>

      <ScreenNotes
        notes={[t('securityLimits.help.noDisable'), t('securityLimits.help.defaults'), t('securityLimits.help.webhooks')]}
      />

      <SaveFooter
        dirty={dirty}
        saving={saving}
        canSave={!hasClientErrors}
        danger={dirty && hasClientErrors}
        message={dirty && hasClientErrors ? t('securityLimits.fixErrors') : undefined}
        onDiscard={() => apply(saved)}
        onSave={save}
      />
    </div>
  );
}

export default function SecurityLimitsPage() {
  const { t } = useI18n();
  return (
    <SecurityScreen title={t('securityLimits.title')} description={t('securityLimits.description')}>
      {(secretKey) => <SecurityLimitsEditor key={secretKey} secretKey={secretKey} />}
    </SecurityScreen>
  );
}
