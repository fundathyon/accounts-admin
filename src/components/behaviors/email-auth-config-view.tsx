'use client';

import Link from 'next/link';
import { Mail, Link2, Link2Off, Lock, ShieldCheck, Palette, Database, KeyRound, FlaskConical, RefreshCw, Pencil } from 'lucide-react';
import { Tooltip } from '@foundathyon/community-ui';
import { Button, buttonVariants } from '@/components/fdn/button';
import { Badge } from '@/components/fdn/badge';
import { useI18n } from '@/context/i18n-context';
import {
  METADATA_SCHEMA_DEFAULTS,
  TESTER_DOMAIN,
  withEmailCodeDefaults,
  withSessionsDefaults,
  type EmailAuthConfig,
  type EmailBrandingConfig,
} from '@/lib/behaviors';
import { buildAdminHref } from '@/lib/utils';

interface ConfigSectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function ConfigSection({ icon, title, children }: ConfigSectionProps) {
  return (
    <div className="rounded-lg border border-border/60 bg-bg-subtle/30 p-4">
      <div className="flex items-center gap-2 mb-3 text-body font-semibold text-text">
        {icon}
        {title}
      </div>
      <div className="space-y-2 text-body">{children}</div>
    </div>
  );
}

function BoolBadge({ value }: { value?: boolean }) {
  const { t } = useI18n();
  if (value == null) return <span className="text-text-muted">—</span>;
  return (
    <Badge variant="tonal" tone={value ? 'success' : 'danger'}>
      {value ? t('emailAuth.yes') : t('emailAuth.no')}
    </Badge>
  );
}

function ConfigRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-text-muted">{label}</span>
      <span className="text-text font-medium">{value}</span>
    </div>
  );
}

function BrandingRows({ branding }: { branding: EmailBrandingConfig }) {
  const { t } = useI18n();
  return (
    <div className="pt-3 mt-2 border-t border-border/50 space-y-2">
      <div className="flex items-center gap-2 text-xs text-text-muted uppercase tracking-wider">
        <Palette className="w-3.5 h-3.5" />
        {t('emailAuth.branding')}
      </div>
      <ConfigRow
        label={t('emailAuth.fromName')}
        value={<span className="font-mono text-xs">{branding.from_name || '—'}</span>}
      />
      <ConfigRow
        label={t('emailAuth.subject')}
        value={<span className="font-mono text-xs">{branding.subject || '—'}</span>}
      />
      <ConfigRow
        label={t('emailAuth.logoUrl')}
        value={
          branding.logo_url
            ? <span className="font-mono text-xs truncate max-w-[200px] inline-block align-bottom">{branding.logo_url}</span>
            : <span className="text-text-muted">—</span>
        }
      />
      <ConfigRow
        label={t('emailAuth.buttonColor')}
        value={
          branding.button_color ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 rounded border border-border" style={{ backgroundColor: branding.button_color }} />
              <span className="font-mono text-xs">{branding.button_color}</span>
            </span>
          ) : <span className="text-text-muted">—</span>
        }
      />
    </div>
  );
}

function StrategyBadge({ strategy }: { strategy?: string }) {
  const value = strategy ?? 'random';
  return (
    <Badge variant="tonal" tone={value === 'fixed' ? 'warning' : 'success'} className="font-mono text-xs">
      {value}
    </Badge>
  );
}

function NumberValue({ value }: { value?: number }) {
  return <span className="font-mono">{value ?? '—'}</span>;
}

interface EmailAuthConfigViewProps {
  config: EmailAuthConfig;
  /** In Pro the sessions in force live in the `tokens` behavior. */
  isPro: boolean;
  onToggleVerification?: () => void;
  togglingVerification?: boolean;
  onToggleMagicLink?: () => void;
  togglingMagicLink?: boolean;
  onToggleEmailCode?: () => void;
  togglingEmailCode?: boolean;
  onToggleTesters?: () => void;
  togglingTesters?: boolean;
  onEditSessions?: () => void;
  onActivateMetadataSchema?: () => void;
  activatingMetadataSchema?: boolean;
}

export function EmailAuthConfigView({
  config,
  isPro,
  onToggleVerification,
  togglingVerification,
  onToggleMagicLink,
  togglingMagicLink,
  onToggleEmailCode,
  togglingEmailCode,
  onToggleTesters,
  togglingTesters,
  onEditSessions,
  onActivateMetadataSchema,
  activatingMetadataSchema,
}: EmailAuthConfigViewProps) {
  const { t } = useI18n();
  const email = config.email ?? {};
  const magic = config.magic_link ?? {};
  const password = config.password ?? {};
  const policy = password.policy ?? {};
  const verification = config.verification ?? {};
  // Without the node the backend applies these same defaults.
  const code = withEmailCodeDefaults(config.email_code);
  const sessions = withSessionsDefaults(config.sessions);
  const testers = config.testers ?? { enabled: false };
  const metadataSchema = config.metadata_schema ?? METADATA_SCHEMA_DEFAULTS;
  const breachedSupported = typeof policy.check_breached === 'boolean';

  return (
    <div className="space-y-6">
      {config.identifier && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted uppercase tracking-wider">{t('emailAuth.identifier')}</span>
          <Badge variant="tonal" tone="neutral" className="font-mono">
            {config.identifier}
          </Badge>
        </div>
      )}


      <div className="grid gap-4 md:grid-cols-2">
        <ConfigSection icon={<Mail className="w-4 h-4 text-text-muted" />} title={t('emailAuth.email')}>
          <ConfigRow label={t('emailAuth.active')} value={<BoolBadge value={email.enabled} />} />
          <ConfigRow label={t('emailAuth.allowPlusAlias')} value={<BoolBadge value={email.allow_plus_alias} />} />
          {email.normalize && (
            <div className="pt-2 mt-2 border-t border-border/50">
              <div className="text-xs text-text-muted mb-1">{t('emailAuth.normalization')}</div>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  lowercase: {email.normalize.lowercase ? t('emailAuth.yes') : t('emailAuth.no')}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  trim: {email.normalize.trim ? t('emailAuth.yes') : t('emailAuth.no')}
                </Badge>
              </div>
            </div>
          )}
        </ConfigSection>

        <ConfigSection icon={<Link2 className="w-4 h-4 text-text-muted" />} title={t('emailAuth.magicLink')}>
          <ConfigRow label={t('emailAuth.active')} value={<BoolBadge value={magic.enabled} />} />
          <ConfigRow label={t('emailAuth.autoSignup')} value={<BoolBadge value={magic.auto_signup} />} />
          <ConfigRow label={t('emailAuth.singleUse')} value={<BoolBadge value={magic.single_use} />} />
          <ConfigRow label={t('emailAuth.bindToIp')} value={<BoolBadge value={magic.bind_to_ip} />} />
          <ConfigRow label={t('emailAuth.bindToUserAgent')} value={<BoolBadge value={magic.bind_to_user_agent} />} />
          <ConfigRow
            label={t('emailAuth.maxAttemptsWindow')}
            value={<span className="font-mono">{magic.max_attempts_per_window ?? '—'}</span>}
          />
          <ConfigRow label={t('emailAuth.ttlSec')} value={<span className="font-mono">{magic.ttl_seconds ?? '—'}</span>} />
          <ConfigRow label={t('emailAuth.windowSec')} value={<span className="font-mono">{magic.window_seconds ?? '—'}</span>} />
          <ConfigRow
            label={t('emailAuth.redirectBaseUrl')}
            value={
              magic.redirect_base_url
                ? <span className="font-mono text-xs truncate max-w-[220px] inline-block align-bottom">{magic.redirect_base_url}</span>
                : <span className="text-text-muted">—</span>
            }
          />
          <ConfigRow
            label={t('emailAuth.defaultRedirectPath')}
            value={<span className="font-mono text-xs">{magic.default_redirect_path || '—'}</span>}
          />

          {magic.email_branding && <BrandingRows branding={magic.email_branding} />}

          {onToggleMagicLink && (
            <div className="pt-3 mt-2 border-t border-border/50">
              <Tooltip content={magic.enabled ? t('behaviors.magicLinkDeactivated') : t('behaviors.magicLinkActivated')}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onToggleMagicLink}
                  loading={togglingMagicLink}
                  className="gap-2"
                >
                  {magic.enabled ? <Link2Off className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                  {magic.enabled ? t('emailAuth.deactivateMagicLink') : t('emailAuth.activateMagicLink')}
                </Button>
              </Tooltip>
            </div>
          )}
        </ConfigSection>

        <ConfigSection icon={<Lock className="w-4 h-4 text-text-muted" />} title={t('emailAuth.password')}>
          <ConfigRow label={t('emailAuth.active')} value={<BoolBadge value={password.enabled} />} />
          {policy && (
            <div className="pt-2 mt-2 space-y-1 border-t border-border/50">
              <div className="text-xs text-text-muted mb-1">{t('emailAuth.policy')}</div>
              <ConfigRow label={t('emailAuth.minLength')} value={<span className="font-mono">{policy.min_length ?? '—'}</span>} />
              <ConfigRow label={t('emailAuth.maxLength')} value={<span className="font-mono">{policy.max_length ?? '—'}</span>} />
              <ConfigRow label={t('emailAuth.minUppercase')} value={<span className="font-mono">{policy.min_uppercase ?? '—'}</span>} />
              <ConfigRow label={t('emailAuth.minLowercase')} value={<span className="font-mono">{policy.min_lowercase ?? '—'}</span>} />
              <ConfigRow label={t('emailAuth.minDigits')} value={<span className="font-mono">{policy.min_digits ?? '—'}</span>} />
              <ConfigRow label={t('emailAuth.minSpecialChar')} value={<span className="font-mono">{policy.min_special_char ?? '—'}</span>} />
              <ConfigRow
                label={t('emailAuth.specialChars')}
                value={
                  <span className="font-mono text-xs">
                    {policy.special_chars?.length ? `[${policy.special_chars.join(', ')}]` : '—'}
                  </span>
                }
              />
              <ConfigRow
                label={t('emailAuth.denyCommonPasswords')}
                value={<BoolBadge value={policy.deny_common_passwords} />}
              />
              <ConfigRow
                label={t('emailAuth.checkBreached')}
                value={
                  breachedSupported
                    ? <BoolBadge value={policy.check_breached} />
                    : <span className="text-xs text-text-muted">{t('emailAuth.updateAccounts')}</span>
                }
              />
            </div>
          )}
        </ConfigSection>

        <ConfigSection icon={<ShieldCheck className="w-4 h-4 text-text-muted" />} title={t('emailAuth.verification')}>
          <ConfigRow label={t('emailAuth.active')} value={<BoolBadge value={verification.enabled} />} />
          <ConfigRow label={t('emailAuth.mode')} value={<span className="font-mono">{verification.mode || '—'}</span>} />
          <ConfigRow label={t('emailAuth.codeSize')} value={<span className="font-mono">{verification.code_size ?? '—'}</span>} />
          <ConfigRow label={t('emailAuth.codeType')} value={<span className="font-mono">{verification.code_type ?? '—'}</span>} />
          <ConfigRow label={t('emailAuth.ttlSec')} value={<span className="font-mono">{verification.ttl_seconds ?? '—'}</span>} />
          <ConfigRow label={t('emailAuth.codeStrategy')} value={<StrategyBadge strategy={verification.code_strategy} />} />
          {verification.code_strategy === 'fixed' && (
            <ConfigRow
              label={t('emailAuth.fixedCode')}
              value={<span className="font-mono text-warning">{verification.fixed_code || '—'}</span>}
            />
          )}
          {onToggleVerification && (
            <div className="pt-3 mt-2 border-t border-border/50">
              <Tooltip content={verification.enabled ? t('behaviors.verificationDeactivated') : t('behaviors.verificationActivated')}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onToggleVerification}
                  loading={togglingVerification}
                  className="gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {verification.enabled ? t('emailAuth.deactivateVerification') : t('emailAuth.activateVerification')}
                </Button>
              </Tooltip>
            </div>
          )}
        </ConfigSection>

        <ConfigSection icon={<KeyRound className="w-4 h-4 text-text-muted" />} title={t('emailAuth.emailCode.title')}>
          <ConfigRow label={t('emailAuth.active')} value={<BoolBadge value={code.enabled} />} />
          <ConfigRow label={t('emailAuth.autoSignup')} value={<BoolBadge value={code.auto_signup} />} />
          <ConfigRow label={t('emailAuth.emailCode.codeLength')} value={<NumberValue value={code.code_size} />} />
          <ConfigRow label={t('emailAuth.codeType')} value={<span className="font-mono">{code.code_type}</span>} />
          <ConfigRow label={t('emailAuth.codeStrategy')} value={<StrategyBadge strategy={code.code_strategy} />} />
          {code.code_strategy === 'fixed' && (
            <ConfigRow
              label={t('emailAuth.fixedCode')}
              value={<span className="font-mono text-warning">{code.fixed_code || '—'}</span>}
            />
          )}
          <ConfigRow label={t('emailAuth.emailCode.validity')} value={<NumberValue value={code.ttl_seconds} />} />
          <ConfigRow label={t('emailAuth.emailCode.attemptsPerCode')} value={<NumberValue value={code.max_verify_attempts} />} />
          <ConfigRow label={t('emailAuth.emailCode.resendCooldown')} value={<NumberValue value={code.resend_cooldown_seconds} />} />
          <ConfigRow label={t('emailAuth.emailCode.maxSendsWindow')} value={<NumberValue value={code.max_attempts_per_window} />} />
          <ConfigRow label={t('emailAuth.windowSec')} value={<NumberValue value={code.window_seconds} />} />
          <ConfigRow label={t('emailAuth.emailCode.singleActiveCode')} value={<BoolBadge value={code.single_active_code} />} />
          <ConfigRow label={t('emailAuth.bindToIp')} value={<BoolBadge value={code.bind_to_ip} />} />
          <ConfigRow label={t('emailAuth.bindToUserAgent')} value={<BoolBadge value={code.bind_to_user_agent} />} />

          {code.email_branding && Object.keys(code.email_branding).length > 0 && <BrandingRows branding={code.email_branding} />}

          {onToggleEmailCode && (
            <div className="pt-3 mt-2 border-t border-border/50">
              <Button
                variant="secondary"
                size="sm"
                onClick={onToggleEmailCode}
                loading={togglingEmailCode}
                className="gap-2"
              >
                <KeyRound className="w-4 h-4" />
                {code.enabled ? t('emailAuth.emailCode.deactivate') : t('emailAuth.emailCode.activate')}
              </Button>
            </div>
          )}
        </ConfigSection>

        <ConfigSection icon={<FlaskConical className="w-4 h-4 text-text-muted" />} title={t('emailAuth.testers.title')}>
          <ConfigRow label={t('emailAuth.active')} value={<BoolBadge value={testers.enabled} />} />
          <p className="text-xs text-text-muted">{t('emailAuth.testers.info', { domain: TESTER_DOMAIN })}</p>
          {onToggleTesters && (
            <div className="pt-3 mt-2 border-t border-border/50">
              <Button
                variant="secondary"
                size="sm"
                onClick={onToggleTesters}
                loading={togglingTesters}
                className="gap-2"
              >
                <FlaskConical className="w-4 h-4" />
                {testers.enabled ? t('emailAuth.testers.deactivate') : t('emailAuth.testers.activate')}
              </Button>
            </div>
          )}
        </ConfigSection>

        <ConfigSection icon={<RefreshCw className="w-4 h-4 text-text-muted" />} title={t('emailAuth.sessions.title')}>
          <ConfigRow label={t('emailAuth.sessions.rotation')} value={<BoolBadge value={sessions.refresh_rotation} />} />
          <ConfigRow label={t('emailAuth.sessions.reuseInterval')} value={<NumberValue value={sessions.reuse_interval_seconds} />} />
          <ConfigRow
            label={t('emailAuth.sessions.idleTimeout')}
            value={
              sessions.idle_timeout_seconds === 0
                ? <span>{t('emailAuth.sessions.noLimit')}</span>
                : <NumberValue value={sessions.idle_timeout_seconds} />
            }
          />
          <p className="text-xs text-text-muted">
            {isPro ? t('emailAuth.sessions.proNote') : t('emailAuth.sessions.note')}
          </p>
          <div className="pt-3 mt-2 border-t border-border/50">
            {isPro ? (
              <Link
                href={buildAdminHref('/behaviors/tokens')}
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              >
                {t('emailAuth.sessions.openTokens')}
              </Link>
            ) : (
              onEditSessions && (
                <Button variant="secondary" size="sm" onClick={onEditSessions} className="gap-2">
                  <Pencil className="w-4 h-4" />
                  {t('emailAuth.sessions.edit')}
                </Button>
              )
            )}
          </div>
        </ConfigSection>
      </div>

      <ConfigSection icon={<Database className="w-4 h-4 text-text-muted" />} title={t('emailAuth.metadataSchema')}>
        <ConfigRow label={t('emailAuth.active')} value={<BoolBadge value={metadataSchema.enabled} />} />
        <ConfigRow
          label={t('emailAuth.metadataAdditionalProps')}
          value={<BoolBadge value={metadataSchema.additional_properties} />}
        />
        {metadataSchema.scheme && metadataSchema.scheme.length > 0 && (
          <div className="pt-2 mt-2 border-t border-border/50 space-y-2">
            <div className="text-xs text-text-muted mb-2">{t('emailAuth.metadataFields')}</div>
            {metadataSchema.scheme.map((field) => (
              <div key={field.name} className="flex items-center justify-between gap-2 py-1 pl-2 border-l-2 border-border">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs text-text truncate">{field.name}</span>
                  <Badge variant="outline" className="text-[10px] font-mono shrink-0">{field.type}</Badge>
                  {field.required && (
                    <Badge variant="tonal" tone="danger" className="text-[10px] shrink-0">
                      {t('emailAuth.metadataRequired')}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0 text-[10px] text-text-muted">
                  {field.format && <span className="font-mono">/{field.format}/</span>}
                  {field.enum && field.enum.length > 0 && (
                    <span className="font-mono">[{field.enum.join(', ')}]</span>
                  )}
                  {field.min_length != null && <span>min:{field.min_length}</span>}
                  {field.max_length != null && <span>max:{field.max_length}</span>}
                  {field.minimum != null && <span>≥{field.minimum}</span>}
                  {field.maximum != null && <span>≤{field.maximum}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        {onActivateMetadataSchema && (
          <div className="pt-3 mt-2 border-t border-border/50">
            <Tooltip content={t('emailAuth.configureMetadataSchemaTooltip')}>
              <Button
                variant="secondary"
                size="sm"
                onClick={onActivateMetadataSchema}
                loading={activatingMetadataSchema}
                className="gap-2"
              >
                <Database className="w-4 h-4" />
                {t('emailAuth.configureMetadataSchema')}
              </Button>
            </Tooltip>
          </div>
        )}
      </ConfigSection>
    </div>
  );
}
