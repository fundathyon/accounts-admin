'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, ShieldCheck, ShieldOff, Trash2, PlayCircle } from 'lucide-react';
import {
  Alert,
  Card,
  CardBody,
  CodeBlock,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormField,
  Icon,
  Input,
  Select,
  Switch,
  Text,
  Textarea,
} from '@foundathyon/community-ui';
import { Button, IconButton } from '@/components/fdn/button';
import { RichMessage } from '@/components/security-screen/rich-message';
import { SaveFooter } from '@/components/security-screen/save-footer';
import { SectionHeading } from '@/components/security-screen/screen-parts';
import { ScreenLoadError, ScreenLoading } from '@/components/security-screen/screen-states';
import { SecurityScreen } from '@/components/security-screen/security-screen';
import { useAdmin } from '@/context/admin-context';
import { useEdition } from '@/context/edition-context';
import { useI18n } from '@/context/i18n-context';
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning';
import type { MetadataSchemaConfig } from '@/lib/admin-types';
import { apiError, type Envelope } from '@/lib/api-envelope';
import {
  RESERVED_KEYS,
  allowedKeysOf,
  blankField,
  buildScheme,
  draftIssue,
  fieldsFromScheme,
  isSensitiveKey,
  type FieldType,
  type PolicyPreview,
  type SchemaField,
} from '@/lib/user-metadata';

type BehaviorRow = { id: string; behavior_code: string; config?: Record<string, unknown> };

const FIELD_TYPES: { value: FieldType; label: FieldType }[] = [
  { value: 'string', label: 'string' },
  { value: 'number', label: 'number' },
  { value: 'boolean', label: 'boolean' },
];

type Draft = {
  schemaEnabled: boolean;
  additionalProps: boolean;
  fields: SchemaField[];
  policyEnabled: boolean;
  /** null: this Accounts does not report it, so it is not sent. */
  includeUserWritable: boolean | null;
};

/** What the save would send: row ids and open panels do not make a draft dirty. */
function draftKey(d: Draft): string {
  return JSON.stringify([d.schemaEnabled, d.additionalProps, buildScheme(d.fields), allowedKeysOf(d.fields), d.policyEnabled, d.includeUserWritable]);
}

function FieldRow({
  field,
  policyAvailable,
  disabled,
  onChange,
  onInJWTChange,
  onRemove,
}: {
  field: SchemaField;
  policyAvailable: boolean;
  disabled: boolean;
  onChange: (patch: Partial<SchemaField>) => void;
  onInJWTChange: (value: boolean) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const reserved = field.inJWT && RESERVED_KEYS.has(field.name.trim());
  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto_auto_auto] sm:items-end">
        <FormField label={t('emailAuth.metadataFieldName')}>
          <Input
            value={field.name}
            // A name that turns sensitive leaves the token until it is confirmed.
            onChange={(e) => onChange({ name: e.target.value, inJWT: field.inJWT && !isSensitiveKey(e.target.value.trim()) })}
            placeholder={t('userMetadata.fields.namePlaceholder')}
            className="font-mono"
            disabled={disabled}
          />
        </FormField>
        <FormField label={t('emailAuth.metadataFieldType')}>
          <Select
            items={FIELD_TYPES}
            value={field.type}
            onValueChange={(v) => onChange({ type: (v ?? 'string') as FieldType })}
            disabled={disabled}
          />
        </FormField>
        <Switch
          label={t('emailAuth.metadataRequired')}
          checked={field.required}
          onCheckedChange={(required) => onChange({ required })}
          disabled={disabled}
        />
        <Switch
          label={t('userMetadata.fields.inToken')}
          checked={field.inJWT}
          onCheckedChange={onInJWTChange}
          disabled={disabled || !policyAvailable}
        />
        <div className="flex items-center justify-end gap-1">
          <IconButton
            icon={field.expanded ? ChevronDown : ChevronRight}
            label={field.expanded ? t('userMetadata.fields.hideAdvanced') : t('userMetadata.fields.showAdvanced')}
            variant="ghost"
            onClick={() => onChange({ expanded: !field.expanded })}
          />
          <IconButton icon={Trash2} label={t('common.delete')} variant="ghost" onClick={onRemove} disabled={disabled} />
        </div>
      </div>

      {reserved && (
        <Alert tone="danger" title={t('userMetadata.errors.reservedClaim', { name: field.name.trim() })} />
      )}

      {field.expanded && field.type === 'boolean' && (
        <Text variant="body-sm" tone="muted" as="p" className="border-t border-border pt-3">
          {t('userMetadata.fields.noAdvanced')}
        </Text>
      )}
      {field.expanded && field.type === 'string' && (
        <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <FormField label={t('userMetadata.fields.format')}>
            <Input
              value={field.format}
              onChange={(e) => onChange({ format: e.target.value })}
              placeholder={t('userMetadata.fields.formatPlaceholder')}
              className="font-mono"
              disabled={disabled}
            />
          </FormField>
          <FormField label={t('emailAuth.metadataEnum')} description={t('emailAuth.metadataEnumHelp')}>
            <Input
              value={field.enumCSV}
              onChange={(e) => onChange({ enumCSV: e.target.value })}
              placeholder={t('userMetadata.fields.enumPlaceholder')}
              className="font-mono"
              disabled={disabled}
            />
          </FormField>
          <FormField label={t('emailAuth.metadataMinLength')}>
            <Input type="number" value={field.minLength} onChange={(e) => onChange({ minLength: e.target.value })} disabled={disabled} />
          </FormField>
          <FormField label={t('emailAuth.metadataMaxLength')}>
            <Input type="number" value={field.maxLength} onChange={(e) => onChange({ maxLength: e.target.value })} disabled={disabled} />
          </FormField>
        </div>
      )}
      {field.expanded && field.type === 'number' && (
        <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <FormField label={t('emailAuth.metadataMinimum')}>
            <Input type="number" value={field.min} onChange={(e) => onChange({ min: e.target.value })} disabled={disabled} />
          </FormField>
          <FormField label={t('emailAuth.metadataMaximum')}>
            <Input type="number" value={field.max} onChange={(e) => onChange({ max: e.target.value })} disabled={disabled} />
          </FormField>
        </div>
      )}
    </div>
  );
}

function PreviewDialog({ open, onClose, secretKey }: { open: boolean; onClose: () => void; secretKey: string }) {
  const { apiUrl, showNotification } = useAdmin();
  const { t } = useI18n();
  const [input, setInput] = useState('{\n  "plan": "pro",\n  "phone": "+12345"\n}');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PolicyPreview | null>(null);

  const evaluate = async () => {
    let metadata: unknown;
    try {
      metadata = JSON.parse(input || '{}');
    } catch {
      showNotification(t('userMetadata.preview.invalidJson'), 'error');
      return;
    }
    if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
      showNotification(t('userMetadata.preview.notObject'), 'error');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(apiUrl('/api/user-metadata-policy/preview'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Secret-API-Key': secretKey },
        body: JSON.stringify({ metadata }),
      });
      const json = (await res.json().catch(() => null)) as (Envelope & { data?: PolicyPreview }) | null;
      if (!res.ok) {
        showNotification(apiError(json)?.message ?? t('userMetadata.errors.generic', { status: res.status }), 'error');
        return;
      }
      setResult(json?.data ?? null);
    } catch {
      showNotification(t('securityScreens.networkError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const hasClaims = result !== null && Object.keys(result.extra_claims ?? {}).length > 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="lg" className="max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('userMetadata.preview.title')}</DialogTitle>
          <DialogDescription>
            <RichMessage text={t('userMetadata.preview.description')} />
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <FormField label={t('userMetadata.preview.inputLabel')}>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={8}
              className="font-mono"
              disabled={loading}
            />
          </FormField>
          {result && (
            <div className="space-y-2">
              <Text as="p" className="flex items-center gap-2 font-medium">
                <Icon icon={hasClaims ? ShieldCheck : ShieldOff} size={16} className={hasClaims ? 'text-success' : 'text-text-muted'} />
                {hasClaims ? t('userMetadata.preview.claimsAdded') : t('userMetadata.preview.noClaims')}
              </Text>
              <CodeBlock
                code={JSON.stringify(result.extra_claims ?? {}, null, 2)}
                language="json"
                copy
                copyLabel={t('common.copy')}
                copiedLabel={t('common.copied')}
              />
              {result.reason && (
                <Text variant="body-sm" tone="muted" as="p">{t('userMetadata.preview.reason', { reason: result.reason })}</Text>
              )}
              {result.dropped_keys && result.dropped_keys.length > 0 && (
                <Text variant="body-sm" tone="muted" as="p">
                  <RichMessage text={t('userMetadata.preview.dropped', { keys: result.dropped_keys.join(', ') })} />
                </Text>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={loading}>{t('common.close')}</Button>
          <Button variant="primary" onClick={evaluate} loading={loading}>{t('userMetadata.preview.evaluate')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserMetadataEditor({ secretKey, isPro }: { secretKey: string; isPro: boolean }) {
  const { apiUrl, showNotification } = useAdmin();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // A Pro backend without the route (404) counts as not available too.
  const [policyAvailable, setPolicyAvailable] = useState(isPro);
  const [emailAuth, setEmailAuth] = useState<{ id: string; identifier: string } | null>(null);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingSensitive, setPendingSensitive] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const headers = useMemo(() => ({ 'X-Secret-API-Key': secretKey }), [secretKey]);

  const load = useCallback(async (reload = false) => {
    if (!reload) setLoading(true);
    setLoadError('');
    try {
      let allowedKeys: string[] = [];
      let policyEnabled = false;
      let includeUserWritable: boolean | null = null;
      if (isPro) {
        const res = await fetch(apiUrl('/api/user-metadata-policy'), { headers, cache: 'no-store' });
        if (res.status === 404) {
          setPolicyAvailable(false);
        } else {
          const json = (await res.json().catch(() => null)) as { data?: Record<string, unknown> } | null;
          const data = res.ok ? json?.data : undefined;
          if (data) {
            allowedKeys = Array.isArray(data.allowed_keys) ? (data.allowed_keys as string[]) : [];
            policyEnabled = Boolean(data.enabled);
            if (typeof data.include_user_writable === 'boolean') includeUserWritable = data.include_user_writable;
          }
        }
      }

      const listRes = await fetch(apiUrl('/api/behaviors'), { headers, cache: 'no-store' });
      const listJson = (await listRes.json().catch(() => null)) as (Envelope & { data?: BehaviorRow[] }) | null;
      if (!listRes.ok) {
        setLoadError(apiError(listJson)?.message ?? t('userMetadata.errors.behaviors', { status: listRes.status }));
        return;
      }
      const row = (Array.isArray(listJson?.data) ? listJson.data : []).find((b) => b.behavior_code === 'email_auth');
      let next: Draft = { schemaEnabled: false, additionalProps: true, fields: [], policyEnabled, includeUserWritable };
      if (row) {
        const detailRes = await fetch(apiUrl(`/api/behaviors/${encodeURIComponent(row.id)}`), { headers, cache: 'no-store' });
        const detailJson = (await detailRes.json().catch(() => null)) as (Envelope & { data?: BehaviorRow }) | null;
        if (!detailRes.ok) {
          setLoadError(apiError(detailJson)?.message ?? t('userMetadata.errors.behaviorDetail', { status: detailRes.status }));
          return;
        }
        const config = detailJson?.data?.config ?? {};
        // Accounts compares it with the stored one: a config without it must not send one.
        setEmailAuth({ id: row.id, identifier: typeof config.identifier === 'string' ? config.identifier : '' });
        const schema = (config.metadata_schema ?? {}) as Partial<MetadataSchemaConfig>;
        next = {
          ...next,
          schemaEnabled: Boolean(schema.enabled),
          additionalProps: typeof schema.additional_properties === 'boolean' ? schema.additional_properties : true,
          fields: fieldsFromScheme(Array.isArray(schema.scheme) ? schema.scheme : [], allowedKeys),
        };
      } else {
        setEmailAuth(null);
      }
      setSaved(next);
      setDraft(next);
    } catch {
      setLoadError(t('securityScreens.networkError'));
    } finally {
      setLoading(false);
    }
  }, [apiUrl, headers, isPro, t]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = saved && draft ? draftKey(saved) !== draftKey(draft) : false;
  useUnsavedChangesWarning(dirty);

  if (loading) return <ScreenLoading />;
  if (loadError || !saved || !draft) return <ScreenLoadError message={loadError} onRetry={() => load()} />;

  const patchDraft = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const updateField = (rowId: string, patch: Partial<SchemaField>) => {
    setDraft((d) => (d ? { ...d, fields: d.fields.map((f) => (f.rowId === rowId ? { ...f, ...patch } : f)) } : d));
  };

  // Fields are only validated with the schema on: adding the first one turns it
  // on, otherwise saving a field would look like it does nothing.
  const addField = () => {
    if (draft.fields.length === 0 && !draft.schemaEnabled) showNotification(t('userMetadata.toasts.schemaActivated'), 'success');
    setDraft((d) =>
      d ? { ...d, schemaEnabled: d.schemaEnabled || d.fields.length === 0, fields: [...d.fields, blankField()] } : d,
    );
  };

  // Accounts keeps the list but emits no claim with the policy off, so marking a
  // field turns the policy on as well.
  const includeInJWT = (rowId: string) => {
    updateField(rowId, { inJWT: true });
    if (!draft.policyEnabled) {
      patchDraft({ policyEnabled: true });
      showNotification(t('userMetadata.toasts.policyActivated'), 'success');
    }
  };

  const handleInJWTChange = (field: SchemaField, value: boolean) => {
    if (!value) updateField(field.rowId, { inJWT: false });
    else if (isSensitiveKey(field.name.trim())) setPendingSensitive(field.rowId);
    else includeInJWT(field.rowId);
  };

  const issue = draftIssue(draft.fields, draft.schemaEnabled, emailAuth !== null, t);
  const namedCount = draft.fields.filter((f) => f.name.trim()).length;
  const jwtFieldCount = allowedKeysOf(draft.fields).length;
  const sensitiveInJWT = draft.fields.filter((f) => f.inJWT && isSensitiveKey(f.name.trim()));

  const save = async () => {
    if (saving || issue) return;
    const body = { scheme: buildScheme(draft.fields), additional_properties: draft.additionalProps };
    const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };
    setSaving(true);
    try {
      // 1. Schema. On: the activate endpoint, which validates the fields. Off:
      // the fields are kept in the behavior with enabled=false.
      if (draft.schemaEnabled) {
        const res = await fetch(apiUrl('/api/behaviors/email/metadata-schema/activate'), {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as Envelope | null;
          showNotification(apiError(json)?.message ?? t('userMetadata.errors.schemaSave', { status: res.status }), 'error');
          return;
        }
      } else if (emailAuth) {
        const res = await fetch(apiUrl(`/api/behaviors/${encodeURIComponent(emailAuth.id)}`), {
          method: 'PUT',
          headers: jsonHeaders,
          body: JSON.stringify({
            config: {
              ...(emailAuth.identifier ? { identifier: emailAuth.identifier } : {}),
              metadata_schema: { enabled: false, ...body },
            },
          }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as Envelope | null;
          showNotification(apiError(json)?.message ?? t('userMetadata.errors.schemaSave', { status: res.status }), 'error');
          return;
        }
      }

      // 2. Access token policy.
      if (policyAvailable) {
        const res = await fetch(apiUrl('/api/user-metadata-policy'), {
          method: 'PUT',
          headers: jsonHeaders,
          body: JSON.stringify({
            enabled: draft.policyEnabled,
            allowed_keys: allowedKeysOf(draft.fields),
            ...(draft.includeUserWritable === null ? {} : { include_user_writable: draft.includeUserWritable }),
          }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as Envelope | null;
          showNotification(apiError(json)?.message ?? t('userMetadata.errors.policySave', { status: res.status }), 'error');
          return;
        }
      }

      showNotification(t('securityScreens.saved'), 'success');
      await load(true);
    } catch {
      showNotification(t('securityScreens.networkError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const pendingField = draft.fields.find((f) => f.rowId === pendingSensitive);

  return (
    <div className="space-y-6">
      {policyAvailable && (
        <div className="flex justify-end">
          <Button variant="secondary" leading={<Icon icon={PlayCircle} size={14} />} onClick={() => setPreviewOpen(true)}>
            {t('userMetadata.previewButton')}
          </Button>
        </div>
      )}

      <Card>
        <CardBody className="space-y-4">
          <Text as="p" className="font-medium">{t('userMetadata.schema.title')}</Text>
          <div className="grid gap-4 sm:grid-cols-2">
            <Switch
              label={t('userMetadata.schema.active')}
              description={<RichMessage text={t('userMetadata.schema.activeHint')} />}
              checked={draft.schemaEnabled}
              onCheckedChange={(schemaEnabled) => patchDraft({ schemaEnabled })}
              disabled={saving}
            />
            <Switch
              label={t('userMetadata.schema.allowExtra')}
              description={t('userMetadata.schema.allowExtraHint')}
              checked={draft.additionalProps}
              onCheckedChange={(additionalProps) => patchDraft({ additionalProps })}
              disabled={saving}
            />
          </div>
          {!draft.schemaEnabled && namedCount > 0 && <Alert tone="warning" title={t('userMetadata.schema.offWarning')} />}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <Switch
            label={t('userMetadata.policy.title')}
            description={t('userMetadata.policy.description')}
            checked={draft.policyEnabled}
            onCheckedChange={(policyEnabled) => patchDraft({ policyEnabled })}
            disabled={!policyAvailable || saving}
          />
          {policyAvailable && draft.includeUserWritable !== null && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <Switch
                label={t('userMetadata.policy.userWritable')}
                description={<RichMessage text={t('userMetadata.policy.userWritableHint')} />}
                checked={draft.includeUserWritable}
                onCheckedChange={(includeUserWritable) => patchDraft({ includeUserWritable })}
                disabled={saving}
              />
              {draft.includeUserWritable && (
                <Alert tone="warning" title={t('userMetadata.policy.userWritableRiskTitle')}>
                  <RichMessage text={t('userMetadata.policy.userWritableRisk', { example: '"plan": "pro"' })} />
                </Alert>
              )}
            </div>
          )}
          {policyAvailable && !draft.policyEnabled && jwtFieldCount > 0 && (
            <Alert
              tone="warning"
              title={t(jwtFieldCount === 1 ? 'userMetadata.policy.offWithFieldsOne' : 'userMetadata.policy.offWithFieldsMany', { count: jwtFieldCount })}
            />
          )}
          {!policyAvailable && (
            <Alert tone="warning" title={t('userMetadata.pro.title')}>{t('userMetadata.pro.body')}</Alert>
          )}
          {sensitiveInJWT.length > 0 && (
            <Alert tone="warning" title={t('userMetadata.sensitive.title')}>
              <span className="block font-mono">{sensitiveInJWT.map((f) => f.name).join(', ')}</span>
              <RichMessage text={t('userMetadata.sensitive.hint')} />
            </Alert>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <SectionHeading title={t('emailAuth.metadataFields')} description={t('userMetadata.fields.hint')} />
            <Button variant="primary" leading={<Icon icon={Plus} size={14} />} onClick={addField} disabled={saving}>
              {t('emailAuth.metadataAddField')}
            </Button>
          </div>
          {draft.fields.length === 0 ? (
            <EmptyState title={t('emailAuth.metadataNoFields')} description={<RichMessage text={t('userMetadata.fields.empty')} />} />
          ) : (
            <div className="space-y-2">
              {draft.fields.map((field) => (
                <FieldRow
                  key={field.rowId}
                  field={field}
                  policyAvailable={policyAvailable}
                  disabled={saving}
                  onChange={(patch) => updateField(field.rowId, patch)}
                  onInJWTChange={(value) => handleInJWTChange(field, value)}
                  onRemove={() => patchDraft({ fields: draft.fields.filter((f) => f.rowId !== field.rowId) })}
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <SaveFooter
        dirty={dirty}
        saving={saving}
        canSave={issue === null}
        danger={issue !== null}
        message={issue ?? (dirty ? t('userMetadata.footer') : undefined)}
        onDiscard={() => setDraft(saved)}
        onSave={save}
      />

      <ConfirmDialog
        open={pendingField !== undefined}
        onOpenChange={(open) => !open && setPendingSensitive(null)}
        title={t('userMetadata.confirm.title')}
        description={t('userMetadata.confirm.description')}
        verb={t('userMetadata.confirm.include')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          if (pendingField) includeInJWT(pendingField.rowId);
          setPendingSensitive(null);
        }}
      />

      <PreviewDialog open={previewOpen} onClose={() => setPreviewOpen(false)} secretKey={secretKey} />
    </div>
  );
}

export default function UserMetadataPage() {
  const { t } = useI18n();
  const { isPro, loading } = useEdition();
  return (
    <SecurityScreen title={t('userMetadata.title')} description={<RichMessage text={t('userMetadata.subtitle')} />}>
      {(secretKey) =>
        // The edition decides whether the Pro-only policy is even asked for.
        loading ? <ScreenLoading /> : <UserMetadataEditor key={`${secretKey}:${isPro}`} secretKey={secretKey} isPro={isPro} />
      }
    </SecurityScreen>
  );
}
