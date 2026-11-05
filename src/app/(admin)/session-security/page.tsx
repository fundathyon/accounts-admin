'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ArrowDown, ChevronDown } from 'lucide-react';
import {
  Alert,
  Card,
  CardBody,
  CodeBlock,
  Heading,
  Icon,
  Radio,
  RadioGroup,
  Switch,
  Text,
  Tooltip,
} from '@foundathyon/community-ui';
import { Badge } from '@/components/fdn/badge';
import { RichMessage } from '@/components/security-screen/rich-message';
import { SaveFooter } from '@/components/security-screen/save-footer';
import { SectionHeading } from '@/components/security-screen/screen-parts';
import { ScreenLoadError, ScreenLoading, ScreenUnavailable } from '@/components/security-screen/screen-states';
import { SecurityScreen } from '@/components/security-screen/security-screen';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning';
import { apiError, type Envelope } from '@/lib/api-envelope';
import {
  MIGRATION_GUIDE_ID,
  OAUTH_EXCHANGE_ENDPOINT,
  SECURE_DEFAULTS,
  TOKEN_DELIVERY_OPTIONS,
  buildPatch,
  changedKeys,
  fieldLabel,
  legacyKeys,
  legacyKeysToMigrate,
  normalizeSessionSecurity,
  sessionSecurityErrorMessage,
  type SessionSecurity,
  type SessionSecurityKey,
  type SessionSecurityValues,
  type TokenDelivery,
} from '@/lib/session-security';

const EXCHANGE_SNIPPET = `const code = new URL(location.href).searchParams.get("code")
const res = await fetch(\`\${ACCOUNTS_URL}/api/v1/oauth/exchange\`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-API-Key": PUBLISHABLE_KEY },
  body: JSON.stringify({ code }),
})
const { data } = await res.json() // data.access_token, data.refresh_token`;

// A legacy setting that needs no migration (query delivery on an app that no
// longer uses it) is shown as neutral, not as something pending.
function LegacyBadge({ pending = true }: { pending?: boolean }) {
  const { t } = useI18n();
  return <Badge tone={pending ? 'warning' : 'neutral'}>{t('sessionSecurity.legacy')}</Badge>;
}

function SwitchRow({
  field,
  checked,
  legacy,
  disabled,
  onChange,
  description,
  impact,
}: {
  field: SessionSecurityKey;
  checked: boolean;
  legacy: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
  description: string;
  impact: string;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-start justify-between gap-3 border-t border-border py-3 last:pb-0">
      <Switch
        className="min-w-0 flex-1"
        label={fieldLabel(t, field)}
        description={
          <>
            {description} <span className="font-medium">{t('sessionSecurity.impactLabel')}</span> {impact}
          </>
        }
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
      />
      {legacy && <LegacyBadge />}
    </div>
  );
}

/** Folded migration guide: opens on request (links to its anchor). */
function MigrationGuide({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n();
  const steps: ReactNode[] = [
    <RichMessage key="1" text={t('sessionSecurity.guide.step1')} />,
    <RichMessage
      key="2"
      text={t('sessionSecurity.guide.step2', { endpoint: OAUTH_EXCHANGE_ENDPOINT, body: '{ "code": "…" }' })}
    />,
    t('sessionSecurity.guide.step3'),
    <RichMessage key="4" text={t('sessionSecurity.guide.step4')} />,
    t('sessionSecurity.guide.step5'),
  ];
  return (
    <Card id={MIGRATION_GUIDE_ID} className="scroll-mt-6">
      <CardBody>
        <Collapsible open={open} onOpenChange={onOpenChange} className="space-y-3">
          <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 text-left">
            <Heading level={2} visual="h5">{t('sessionSecurity.guide.title')}</Heading>
            <Icon
              icon={ChevronDown}
              size={16}
              className="text-text-muted transition-transform group-data-[state=open]:rotate-180"
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3">
            <Text variant="body-sm" tone="muted" as="p">{t('sessionSecurity.guide.intro')}</Text>
            <ol className="list-decimal space-y-2 pl-5 text-body-sm">
              {steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <CodeBlock
              code={EXCHANGE_SNIPPET}
              language="text"
              copy
              copyLabel={t('common.copy')}
              copiedLabel={t('common.copied')}
            />
          </CollapsibleContent>
        </Collapsible>
      </CardBody>
    </Card>
  );
}

function SessionSecurityEditor({ secretKey }: { secretKey: string }) {
  const { apiUrl, showNotification } = useAdmin();
  const { t } = useI18n();

  const [saved, setSaved] = useState<SessionSecurity | null>(null);
  const [draft, setDraft] = useState<SessionSecurityValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  // Links to the guide open it before jumping there.
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === `#${MIGRATION_GUIDE_ID}`) setGuideOpen(true);
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const apply = useCallback((c: SessionSecurity) => {
    setSaved(c);
    setDraft({ ...c.values });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(apiUrl('/api/session-security'), {
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
        setLoadError(sessionSecurityErrorMessage(t, apiError(json), t('sessionSecurity.loadFailed', { status: res.status })));
        return;
      }
      setUnavailable(false);
      apply(normalizeSessionSecurity(json));
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
  useUnsavedChangesWarning(dirty);

  const setField = <K extends SessionSecurityKey>(key: K, value: SessionSecurityValues[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  };

  const save = async () => {
    if (!saved || !draft || saving || !dirty) return;
    setSaving(true);
    try {
      const res = await fetch(apiUrl('/api/session-security'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Secret-API-Key': secretKey },
        body: JSON.stringify(buildPatch(saved.values, draft)),
      });
      if (res.status === 404) {
        setUnavailable(true);
        showNotification(t('sessionSecurity.notConfigurable'), 'error');
        return;
      }
      const json = (await res.json().catch(() => null)) as Envelope | null;
      if (!res.ok) {
        showNotification(
          sessionSecurityErrorMessage(t, apiError(json), t('sessionSecurity.saveFailed', { status: res.status })),
          'error',
        );
        return;
      }
      if (json?.data) apply(normalizeSessionSecurity(json));
      else await load();
      showNotification(t('securityScreens.saved'), 'success');
    } catch {
      showNotification(t('securityScreens.networkError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ScreenLoading />;
  if (unavailable) {
    return <ScreenUnavailable title={t('sessionSecurity.unavailable.title')} body={t('sessionSecurity.unavailable.body')} />;
  }
  if (loadError || !saved || !draft) return <ScreenLoadError message={loadError} onRetry={load} />;

  const defaults = saved.defaults ?? SECURE_DEFAULTS;
  const savedLegacy = legacyKeys(saved.values, saved.defaults);
  // The migration prompt and the status do not ask to change delivery if
  // Accounts says the app no longer gets tokens in the URL.
  const legacyToMigrate = legacyKeysToMigrate(saved);
  const statusTone = legacyToMigrate.length ? 'warning' : savedLegacy.length ? 'neutral' : 'success';
  const deliveryPending =
    legacyToMigrate.includes('oauth_token_delivery') || saved.values.oauth_token_delivery !== draft.oauth_token_delivery;
  const isLegacy = (key: SessionSecurityKey) => draft[key] !== defaults[key];
  const switchingToCode = saved.values.oauth_token_delivery !== 'code' && draft.oauth_token_delivery === 'code';
  const statusText =
    legacyToMigrate.length === 0
      ? savedLegacy.length === 0
        ? t('sessionSecurity.status.recommended')
        : t('sessionSecurity.status.noPending')
      : t(
          legacyToMigrate.length === 1 ? 'sessionSecurity.status.legacyCountOne' : 'sessionSecurity.status.legacyCountMany',
          { count: legacyToMigrate.length },
        );

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Tooltip
          disabled={legacyToMigrate.length === 0}
          side="bottom"
          content={t('sessionSecurity.legacyWarning.body', {
            fields: legacyToMigrate.map((k) => fieldLabel(t, k)).join(', '),
          })}
        >
          <span tabIndex={legacyToMigrate.length ? 0 : -1} className="inline-flex">
            <Badge tone={statusTone}>{statusText}</Badge>
          </span>
        </Tooltip>
      </div>

      <Card>
        <CardBody>
          <div className="space-y-3 pb-3">
            <div className="flex items-start justify-between gap-3">
              <SectionHeading
                id="session-token-delivery-label"
                title={fieldLabel(t, 'oauth_token_delivery')}
                description={t('sessionSecurity.delivery.description')}
              />
              {isLegacy('oauth_token_delivery') && <LegacyBadge pending={deliveryPending} />}
            </div>
            <RadioGroup
              aria-labelledby="session-token-delivery-label"
              value={draft.oauth_token_delivery}
              onValueChange={(v) => setField('oauth_token_delivery', v as TokenDelivery)}
              disabled={saving}
            >
              {TOKEN_DELIVERY_OPTIONS.map((value) => (
                <Radio
                  key={value}
                  value={value}
                  label={t(`sessionSecurity.delivery.${value}.label`)}
                  description={t(`sessionSecurity.delivery.${value}.description`)}
                />
              ))}
            </RadioGroup>
            {switchingToCode && (
              <Alert
                tone="warning"
                title={t('sessionSecurity.codeWarning.title')}
                action={
                  <a
                    href={`#${MIGRATION_GUIDE_ID}`}
                    onClick={() => setGuideOpen(true)}
                    className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
                  >
                    <Icon icon={ArrowDown} size={14} />
                    {t('sessionSecurity.codeWarning.viewGuide')}
                  </a>
                }
              >
                <RichMessage text={t('sessionSecurity.codeWarning.body', { endpoint: OAUTH_EXCHANGE_ENDPOINT })} />
              </Alert>
            )}
          </div>
          <SwitchRow
            field="refresh_rotation"
            checked={draft.refresh_rotation}
            legacy={isLegacy('refresh_rotation')}
            disabled={saving}
            onChange={(v) => setField('refresh_rotation', v)}
            description={t('sessionSecurity.sessions.rotation.description')}
            impact={t('sessionSecurity.sessions.rotation.impact')}
          />
          <SwitchRow
            field="revoke_sessions_on_password_change"
            checked={draft.revoke_sessions_on_password_change}
            legacy={isLegacy('revoke_sessions_on_password_change')}
            disabled={saving}
            onChange={(v) => setField('revoke_sessions_on_password_change', v)}
            description={t('sessionSecurity.sessions.revoke.description')}
            impact={t('sessionSecurity.sessions.revoke.impact')}
          />
        </CardBody>
      </Card>

      <MigrationGuide open={guideOpen} onOpenChange={setGuideOpen} />

      <SaveFooter
        dirty={dirty}
        saving={saving}
        message={dirty ? `${t('securityScreens.dirty')} ${t('sessionSecurity.sessions.description')}` : undefined}
        onDiscard={() => apply(saved)}
        onSave={save}
      />
    </div>
  );
}

export default function SessionSecurityPage() {
  const { t } = useI18n();
  return (
    <SecurityScreen title={t('sessionSecurity.title')} description={t('sessionSecurity.subtitle')}>
      {(secretKey) => <SessionSecurityEditor key={secretKey} secretKey={secretKey} />}
    </SecurityScreen>
  );
}
