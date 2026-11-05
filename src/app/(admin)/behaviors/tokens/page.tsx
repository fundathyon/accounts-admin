'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft, Clock, Info, LogOut, MonitorSmartphone, Pencil, RefreshCw, Settings, type LucideIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Icon,
  Input,
  JsonViewer,
  Select,
  Switch,
  Tab,
  Tabs,
  TabsList,
  TabsPanel,
  Text,
  Tooltip,
} from '@foundathyon/community-ui';
import { Badge } from '@/components/fdn/badge';
import { Button, buttonVariants } from '@/components/fdn/button';
import { ScreenLoadError, ScreenLoading, ScreenUnavailable } from '@/components/security-screen/screen-states';
import { SecurityScreen } from '@/components/security-screen/security-screen';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { apiError, type Envelope } from '@/lib/api-envelope';
import {
  TOKENS_DEFAULTS,
  TOKENS_FIELD_SECTION,
  TOKENS_LIMITS,
  TOKENS_TEMPLATES,
  UNIT_SECONDS,
  bestUnit,
  humanizeDuration,
  tokensRequest,
  validateTokens,
  type DurationUnit,
  type OnLimit,
  type RevokeScope,
  type TokensBehavior,
  type TokensConfig,
  type TokensField,
  type TokensSection,
} from '@/lib/tokens-behavior';
import { buildAdminHref, cn } from '@/lib/utils';

const DAY = UNIT_SECONDS.d;

function BoolBadge({ value }: { value: boolean }) {
  const { t } = useI18n();
  return (
    <Badge variant="tonal" tone={value ? 'success' : 'neutral'}>
      {value ? t('emailAuth.yes') : t('emailAuth.no')}
    </Badge>
  );
}

function ViewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-muted">{label}</span>
      {children}
    </div>
  );
}

function Value({ children, inherited }: { children: ReactNode; inherited?: boolean }) {
  const { t } = useI18n();
  return (
    <span className="flex items-center gap-2">
      {inherited && <span className="text-xs text-text-muted">{t('behaviors.tokens.inherited')}</span>}
      <span className="font-mono text-right">{children}</span>
    </span>
  );
}

function SectionCard({
  icon,
  title,
  meaning,
  editLabel,
  onEdit,
  children,
}: {
  icon: LucideIcon;
  title: string;
  meaning: string;
  editLabel: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-bg-subtle/30 p-4 space-y-3 text-body">
      <div className="flex items-center gap-2 font-semibold text-text">
        <Icon icon={icon} size={16} className="text-text-muted" />
        {title}
      </div>
      {children}
      <p className="border-t border-border pt-3 text-xs text-text-muted">{meaning}</p>
      <Button variant="secondary" size="sm" className="gap-2" onClick={onEdit}>
        <Pencil className="w-4 h-4" /> {editLabel}
      </Button>
    </div>
  );
}

function FieldHint({ text }: { text: string }) {
  return (
    <Tooltip content={text} className="max-w-xs whitespace-normal">
      <Info className="w-3.5 h-3.5 text-text-muted cursor-help" />
    </Tooltip>
  );
}

function DurationField({
  label,
  hint,
  seconds,
  onChange,
  error,
  units = ['min', 'h', 'd'],
}: {
  label: string;
  hint?: string;
  seconds: number;
  onChange: (seconds: number) => void;
  error?: string;
  units?: DurationUnit[];
}) {
  const { t } = useI18n();
  const [unit, setUnit] = useState<DurationUnit>(() => {
    const best = bestUnit(seconds);
    return units.includes(best) ? best : units[0];
  });
  const amount = seconds / UNIT_SECONDS[unit];
  return (
    <FormField
      label={
        <>
          {label}
          {hint && <FieldHint text={hint} />}
        </>
      }
      error={error}
    >
      <div className="flex gap-2">
        <Input
          type="number"
          min={0}
          step="any"
          value={Number.isFinite(amount) ? Number(amount.toFixed(2)) : ''}
          onChange={(e) => onChange(Math.round(Number(e.target.value || 0) * UNIT_SECONDS[unit]))}
          wrapperClassName="flex-1"
        />
        <Select
          items={units.map((u) => ({ value: u, label: t(`behaviors.tokens.units.${u}`) }))}
          value={unit}
          onValueChange={(value) => value && setUnit(value as DurationUnit)}
          className="w-[120px] shrink-0"
        />
      </div>
    </FormField>
  );
}

function RevokeField({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description: string;
  value: RevokeScope;
  options: RevokeScope[];
  onChange: (value: RevokeScope) => void;
}) {
  const { t } = useI18n();
  return (
    <FormField label={label} description={description}>
      <Select
        items={options.map((option) => ({ value: option, label: t(`behaviors.tokens.revoke.label.${option}`) }))}
        value={value}
        onValueChange={(next) => next && onChange(next as RevokeScope)}
        className="w-full"
      />
    </FormField>
  );
}

function TokensEditor({ secretKey }: { secretKey: string }) {
  const { apiUrl, showNotification } = useAdmin();
  const { t, locale } = useI18n();
  const [behavior, setBehavior] = useState<TokensBehavior | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);

  // A copy is edited in the dialog and applied only when saving.
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TokensSection>('lifetimes');
  const [draft, setDraft] = useState<TokensConfig>(TOKENS_DEFAULTS);
  const [draftKey, setDraftKey] = useState(0);
  const [templateId, setTemplateId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(apiUrl('/api/behaviors/tokens'), {
        headers: { 'X-Secret-API-Key': secretKey },
        cache: 'no-store',
      });
      if (res.status === 404) {
        setUnavailable(true);
        return;
      }
      const json = (await res.json().catch(() => null)) as Envelope | null;
      if (!res.ok) {
        setLoadError(apiError(json)?.message ?? t('behaviors.tokens.loadFailed'));
        return;
      }
      setBehavior(json?.data as TokensBehavior);
    } catch {
      setLoadError(t('securityScreens.networkError'));
    } finally {
      setLoading(false);
    }
  }, [apiUrl, secretKey, t]);

  useEffect(() => {
    load();
  }, [load]);

  const errors = useMemo(() => validateTokens(t, draft), [t, draft]);
  const hasErrors = Object.keys(errors).length > 0;
  const sectionHasError = (section: TokensSection) =>
    (Object.keys(errors) as TokensField[]).some((field) => TOKENS_FIELD_SECTION[field] === section);

  const openEditor = (section: TokensSection) => {
    if (!behavior) return;
    setDraft(behavior.effective);
    setDraftKey((k) => k + 1);
    setTemplateId(null);
    setTab(section);
    setOpen(true);
  };

  const patch = <K extends TokensSection>(section: K, value: Partial<TokensConfig[K]>) =>
    setDraft((c) => ({ ...c, [section]: { ...c[section], ...value } }));

  const applyTemplate = (id: string | null) => {
    const template = id ? TOKENS_TEMPLATES[id] : undefined;
    if (!template) return;
    setTemplateId(id);
    setDraft(template);
    setDraftKey((k) => k + 1);
    showNotification(t('behaviors.tokens.templateApplied', { name: t(`behaviors.tokens.templates.${id}`) }), 'success');
  };

  const save = async () => {
    if (hasErrors || !behavior) return;
    setSaving(true);
    try {
      const res = await fetch(apiUrl('/api/behaviors/tokens'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Secret-API-Key': secretKey },
        body: JSON.stringify(tokensRequest(draft, behavior)),
      });
      const json = (await res.json().catch(() => null)) as Envelope | null;
      if (!res.ok) {
        showNotification(apiError(json)?.message ?? t('behaviors.tokens.saveFailed'), 'error');
        return;
      }
      if (json?.data) setBehavior(json.data as TokensBehavior);
      else await load();
      setOpen(false);
      showNotification(t('securityScreens.saved'), 'success');
    } catch {
      showNotification(t('securityScreens.networkError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ScreenLoading />;
  if (unavailable) {
    return <ScreenUnavailable title={t('behaviors.tokens.unavailable.title')} body={t('behaviors.tokens.unavailable.body')} />;
  }
  if (loadError || !behavior) return <ScreenLoadError message={loadError} onRetry={load} />;

  const c = behavior.effective;
  const stored = behavior.config.lifetimes;
  const limitOn = c.limits.max_sessions_per_user > 0;
  const duration = (seconds: number) => humanizeDuration(t, seconds);
  const dateTime = (value?: string) => (value ? new Date(value).toLocaleString(locale) : '—');
  const tabLabel = (icon: LucideIcon, label: string, section: TokensSection) => (
    <span className="inline-flex items-center gap-1.5">
      <Icon icon={icon} size={16} /> {label}
      {sectionHasError(section) && <span className="size-1.5 rounded-full bg-danger-solid" />}
    </span>
  );

  return (
    <div className="space-y-6">
      {behavior.id && <p className="font-mono text-xs text-text-muted">{behavior.id}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          icon={Clock}
          title={t('behaviors.tokens.lifetimes.title')}
          meaning={t('behaviors.tokens.lifetimes.meaning', {
            access: duration(c.lifetimes.access_token_seconds),
            refresh: duration(c.lifetimes.refresh_token_seconds),
          })}
          editLabel={t('behaviors.tokens.lifetimes.edit')}
          onEdit={() => openEditor('lifetimes')}
        >
          <ViewRow label={t('behaviors.tokens.lifetimes.access')}>
            <Value inherited={stored.access_token_seconds === 0}>{duration(c.lifetimes.access_token_seconds)}</Value>
          </ViewRow>
          <ViewRow label={t('behaviors.tokens.lifetimes.maxSession')}>
            <Value inherited={stored.refresh_token_seconds === 0}>{duration(c.lifetimes.refresh_token_seconds)}</Value>
          </ViewRow>
          <ViewRow label={t('behaviors.tokens.lifetimes.activation')}>
            <Value inherited={stored.activation_token_seconds === 0}>{duration(c.lifetimes.activation_token_seconds)}</Value>
          </ViewRow>
          <ViewRow label={t('behaviors.tokens.lifetimes.reset')}>
            <Value inherited={stored.password_reset_token_seconds === 0}>{duration(c.lifetimes.password_reset_token_seconds)}</Value>
          </ViewRow>
        </SectionCard>

        <SectionCard
          icon={RefreshCw}
          title={t('behaviors.tokens.sessions.title')}
          meaning={[
            c.sessions.idle_timeout_seconds > 0
              ? t('behaviors.tokens.sessions.idleMeaning', { time: duration(c.sessions.idle_timeout_seconds) })
              : t('behaviors.tokens.sessions.noIdleMeaning'),
            c.sessions.refresh_rotation ? t('behaviors.tokens.sessions.reuseMeaning') : '',
          ].filter(Boolean).join(' ')}
          editLabel={t('behaviors.tokens.sessions.edit')}
          onEdit={() => openEditor('sessions')}
        >
          <ViewRow label={t('behaviors.tokens.sessions.rotate')}><BoolBadge value={c.sessions.refresh_rotation} /></ViewRow>
          <ViewRow label={t('behaviors.tokens.sessions.reuseGrace')}>
            <Value>{`${c.sessions.reuse_interval_seconds} s`}</Value>
          </ViewRow>
          <ViewRow label={t('behaviors.tokens.sessions.idleClose')}>
            {c.sessions.idle_timeout_seconds > 0
              ? <Value>{duration(c.sessions.idle_timeout_seconds)}</Value>
              : <BoolBadge value={false} />}
          </ViewRow>
        </SectionCard>

        <SectionCard
          icon={MonitorSmartphone}
          title={t('behaviors.tokens.limits.title')}
          meaning={
            limitOn
              ? t(
                  c.limits.max_sessions_per_user === 1
                    ? 'behaviors.tokens.limits.meaningLimitedOne'
                    : 'behaviors.tokens.limits.meaningLimitedMany',
                  { count: c.limits.max_sessions_per_user },
                )
              : t('behaviors.tokens.limits.meaningUnlimited')
          }
          editLabel={t('behaviors.tokens.limits.edit')}
          onEdit={() => openEditor('limits')}
        >
          <ViewRow label={t('behaviors.tokens.limits.limitPerUser')}><BoolBadge value={limitOn} /></ViewRow>
          {limitOn && (
            <>
              <ViewRow label={t('behaviors.tokens.limits.max')}><Value>{c.limits.max_sessions_per_user}</Value></ViewRow>
              <ViewRow label={t('behaviors.tokens.limits.onExceed')}>
                <Badge variant="tonal" tone="neutral">
                  {c.limits.on_limit === 'reject' ? t('behaviors.tokens.limits.rejectLogin') : t('behaviors.tokens.limits.closeOldest')}
                </Badge>
              </ViewRow>
            </>
          )}
        </SectionCard>

        <SectionCard
          icon={LogOut}
          title={t('behaviors.tokens.revocation.title')}
          meaning={t('behaviors.tokens.revocation.meaning')}
          editLabel={t('behaviors.tokens.revocation.edit')}
          onEdit={() => openEditor('revocation')}
        >
          <ViewRow label={t('behaviors.tokens.revocation.passwordChange')}>
            <Badge variant="tonal" tone="neutral">{t(`behaviors.tokens.revoke.short.${c.revocation.on_password_change}`)}</Badge>
          </ViewRow>
          <ViewRow label={t('behaviors.tokens.revocation.passwordReset')}>
            <Badge variant="tonal" tone="neutral">{t(`behaviors.tokens.revoke.short.${c.revocation.on_password_reset}`)}</Badge>
          </ViewRow>
          <ViewRow label={t('behaviors.tokens.revocation.emailChange')}>
            <Badge variant="tonal" tone="neutral">{t(`behaviors.tokens.revoke.short.${c.revocation.on_email_change}`)}</Badge>
          </ViewRow>
        </SectionCard>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-1">
          <div className="text-xs text-text-muted font-medium uppercase">{t('oauth.appId')}</div>
          <div className="text-body font-mono">{behavior.app_id || '—'}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-text-muted font-medium uppercase">{t('behaviors.dateCreated')}</div>
          <div className="text-body">{dateTime(behavior.created_at)}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-text-muted font-medium uppercase">{t('behaviors.lastUpdate')}</div>
          <div className="text-body">{dateTime(behavior.updated_at)}</div>
        </div>
      </div>

      <Collapsible className="space-y-2">
        <CollapsibleTrigger className="text-body-sm text-text-muted hover:text-text">
          {t('behaviors.configJson')}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <JsonViewer data={behavior.config} defaultExpandDepth={2} expandable copyValue copyPath />
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-text-muted" /> {t('behaviors.tokens.dialog.title')}
            </DialogTitle>
            <DialogDescription>{t('behaviors.tokens.dialog.description')}</DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-3 rounded-lg bg-bg-subtle px-3 py-2">
            <Text variant="body-sm" tone="muted">{t('behaviors.tokens.dialog.startFromTemplate')}</Text>
            <Select
              items={Object.keys(TOKENS_TEMPLATES).map((id) => ({ value: id, label: t(`behaviors.tokens.templates.${id}`) }))}
              value={templateId}
              onValueChange={applyTemplate}
              className="w-[200px]"
              placeholder={t('behaviors.tokens.dialog.choose')}
            />
          </div>

          <Tabs key={draftKey} value={tab} onValueChange={(value) => setTab(value as TokensSection)}>
            <TabsList className="overflow-x-auto overflow-y-hidden">
              <Tab value="lifetimes" className="shrink-0 whitespace-nowrap">
                {tabLabel(Clock, t('behaviors.tokens.dialog.tabLifetimes'), 'lifetimes')}
              </Tab>
              <Tab value="sessions" className="shrink-0 whitespace-nowrap">
                {tabLabel(RefreshCw, t('behaviors.tokens.dialog.tabSessions'), 'sessions')}
              </Tab>
              <Tab value="limits" className="shrink-0 whitespace-nowrap">
                {tabLabel(MonitorSmartphone, t('behaviors.tokens.dialog.tabLimit'), 'limits')}
              </Tab>
              <Tab value="revocation" className="shrink-0 whitespace-nowrap">
                {tabLabel(LogOut, t('behaviors.tokens.dialog.tabRevocation'), 'revocation')}
              </Tab>
            </TabsList>

            <TabsPanel value="lifetimes" className="space-y-4 pt-3">
              <DurationField
                label={t('behaviors.tokens.lifetimes.access')}
                hint={t('behaviors.tokens.dialog.accessHint')}
                seconds={draft.lifetimes.access_token_seconds}
                onChange={(v) => patch('lifetimes', { access_token_seconds: v })}
                error={errors.access}
                units={['min', 'h']}
              />
              <DurationField
                label={t('behaviors.tokens.lifetimes.maxSession')}
                hint={t('behaviors.tokens.dialog.refreshHint')}
                seconds={draft.lifetimes.refresh_token_seconds}
                onChange={(v) => patch('lifetimes', { refresh_token_seconds: v })}
                error={errors.refresh}
                units={['h', 'd']}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <DurationField
                  label={t('behaviors.tokens.lifetimes.activation')}
                  hint={t('behaviors.tokens.dialog.activationHint')}
                  seconds={draft.lifetimes.activation_token_seconds}
                  onChange={(v) => patch('lifetimes', { activation_token_seconds: v })}
                  error={errors.activation}
                  units={['min', 'h']}
                />
                <DurationField
                  label={t('behaviors.tokens.dialog.resetToken')}
                  hint={t('behaviors.tokens.dialog.resetHint')}
                  seconds={draft.lifetimes.password_reset_token_seconds}
                  onChange={(v) => patch('lifetimes', { password_reset_token_seconds: v })}
                  error={errors.reset}
                  units={['min', 'h']}
                />
              </div>
              <Text variant="body-sm" tone="muted" as="p">{t('behaviors.tokens.dialog.inheritedNote')}</Text>
            </TabsPanel>

            <TabsPanel value="sessions" className="space-y-4 pt-3">
              <Switch
                label={t('behaviors.tokens.sessions.rotate')}
                description={t('behaviors.tokens.dialog.rotateDesc')}
                checked={draft.sessions.refresh_rotation}
                onCheckedChange={(v) => patch('sessions', { refresh_rotation: v })}
              />
              {draft.sessions.refresh_rotation && (
                <FormField
                  label={
                    <>
                      {t('behaviors.tokens.dialog.reuseSeconds')}
                      <FieldHint text={t('behaviors.tokens.dialog.reuseHint')} />
                    </>
                  }
                  error={errors.reuse}
                >
                  <Input
                    type="number"
                    min={0}
                    max={TOKENS_LIMITS.reuseMax}
                    value={draft.sessions.reuse_interval_seconds}
                    onChange={(e) => patch('sessions', { reuse_interval_seconds: Math.round(Number(e.target.value || 0)) })}
                  />
                </FormField>
              )}
              <Switch
                label={t('behaviors.tokens.dialog.idleTitle')}
                description={t('behaviors.tokens.dialog.idleDesc')}
                checked={draft.sessions.idle_timeout_seconds > 0}
                onCheckedChange={(v) => patch('sessions', { idle_timeout_seconds: v ? 14 * DAY : 0 })}
              />
              {draft.sessions.idle_timeout_seconds > 0 && (
                <DurationField
                  label={t('behaviors.tokens.dialog.idleMax')}
                  seconds={draft.sessions.idle_timeout_seconds}
                  onChange={(v) => patch('sessions', { idle_timeout_seconds: v })}
                  error={errors.idle}
                  units={['h', 'd']}
                />
              )}
            </TabsPanel>

            <TabsPanel value="limits" className="space-y-4 pt-3">
              <Switch
                label={t('behaviors.tokens.dialog.limitTitle')}
                description={t('behaviors.tokens.dialog.limitDesc')}
                checked={draft.limits.max_sessions_per_user > 0}
                onCheckedChange={(v) => patch('limits', { max_sessions_per_user: v ? 5 : 0 })}
              />
              {draft.limits.max_sessions_per_user > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label={t('behaviors.tokens.dialog.maxSessions')} error={errors.maxSessions}>
                    <Input
                      type="number"
                      min={1}
                      max={TOKENS_LIMITS.maxSessions}
                      value={draft.limits.max_sessions_per_user}
                      onChange={(e) => patch('limits', { max_sessions_per_user: Math.max(0, Math.round(Number(e.target.value || 0))) })}
                    />
                  </FormField>
                  <FormField label={t('behaviors.tokens.limits.onExceed')}>
                    <Select
                      items={[
                        { value: 'revoke_oldest', label: t('behaviors.tokens.limits.closeOldest') },
                        { value: 'reject', label: t('behaviors.tokens.dialog.rejectNewLogin') },
                      ]}
                      value={draft.limits.on_limit}
                      onValueChange={(v) => v && patch('limits', { on_limit: v as OnLimit })}
                      className="w-full"
                    />
                  </FormField>
                </div>
              )}
            </TabsPanel>

            <TabsPanel value="revocation" className="space-y-4 pt-3">
              <RevokeField
                label={t('behaviors.tokens.revocation.passwordChange')}
                description={t('behaviors.tokens.dialog.passwordChangeDesc')}
                value={draft.revocation.on_password_change}
                options={['others', 'all', 'none']}
                onChange={(v) => patch('revocation', { on_password_change: v })}
              />
              <RevokeField
                label={t('behaviors.tokens.revocation.passwordReset')}
                description={t('behaviors.tokens.dialog.passwordResetDesc')}
                value={draft.revocation.on_password_reset}
                options={['all', 'none']}
                onChange={(v) => patch('revocation', { on_password_reset: v as 'all' | 'none' })}
              />
              <RevokeField
                label={t('behaviors.tokens.revocation.emailChange')}
                description={t('behaviors.tokens.dialog.emailChangeDesc')}
                value={draft.revocation.on_email_change}
                options={['others', 'all', 'none']}
                onChange={(v) => patch('revocation', { on_email_change: v })}
              />
            </TabsPanel>
          </Tabs>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={save} disabled={hasErrors || saving} loading={saving}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function TokensBehaviorPage() {
  const { t } = useI18n();
  return (
    <>
      <Link
        href={buildAdminHref('/behaviors')}
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'mb-6 gap-2 -ml-2')}
      >
        <ChevronLeft className="w-4 h-4" /> {t('behaviors.backToBehaviors')}
      </Link>
      <SecurityScreen
        title={t('behaviors.tokens.title')}
        description={t('behaviors.tokens.subtitle')}
        proOnlyDescription={t('behaviors.tokens.proOnly')}
      >
        {(secretKey) => <TokensEditor key={secretKey} secretKey={secretKey} />}
      </SecurityScreen>
    </>
  );
}
