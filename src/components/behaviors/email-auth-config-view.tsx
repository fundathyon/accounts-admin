'use client';

import { Mail, Link2, Link2Off, Lock, ShieldCheck, Palette, Database } from 'lucide-react';
import { Badge, Button, Tooltip } from '@foundathyon/community-ui';
import { useI18n } from '@/context/i18n-context';
import type { MetadataSchemaConfig } from '@/lib/admin-types';

export interface EmailAuthConfig {
  identifier?: string;
  email?: {
    allow_plus_alias?: boolean;
    enabled?: boolean;
    normalize?: { lowercase?: boolean; trim?: boolean };
  };
  magic_link?: {
    bind_to_ip?: boolean;
    bind_to_user_agent?: boolean;
    enabled?: boolean;
    max_attempts_per_window?: number;
    single_use?: boolean;
    ttl_seconds?: number;
    window_seconds?: number;
    auto_signup?: boolean;
    redirect_base_url?: string;
    default_redirect_path?: string;
    email_branding?: {
      from_name?: string;
      subject?: string;
      logo_url?: string;
      button_color?: string;
    };
  };
  password?: {
    enabled?: boolean;
    policy?: {
      deny_common_passwords?: boolean;
      max_length?: number;
      min_digits?: number;
      min_length?: number;
      min_lowercase?: number;
      min_special_char?: number;
      min_uppercase?: number;
      special_chars?: string[];
    };
  };
  verification?: {
    code_size?: number;
    code_type?: string;
    enabled?: boolean;
    mode?: string;
    ttl_seconds?: number;
    code_strategy?: 'random' | 'fixed';
    fixed_code?: string;
  };
  metadata_schema?: MetadataSchemaConfig;
}

export const FIXED_CODE_ALLOWED_ENVS = ['local', 'development', 'staging', 'qa', 'test'] as const;

interface ConfigSectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function ConfigSection({ icon, title, children }: ConfigSectionProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-foreground">
        {icon}
        {title}
      </div>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  );
}

function BoolBadge({ value }: { value?: boolean }) {
  const { t } = useI18n();
  if (value == null) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant="tonal" tone={value ? 'success' : 'danger'}>
      {value ? t('emailAuth.yes') : t('emailAuth.no')}
    </Badge>
  );
}

function ConfigRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}

interface EmailAuthConfigViewProps {
  config: EmailAuthConfig;
  onToggleVerification?: () => void;
  togglingVerification?: boolean;
  onToggleMagicLink?: () => void;
  togglingMagicLink?: boolean;
  onActivateMetadataSchema?: () => void;
  activatingMetadataSchema?: boolean;
}

export function EmailAuthConfigView({
  config,
  onToggleVerification,
  togglingVerification,
  onToggleMagicLink,
  togglingMagicLink,
  onActivateMetadataSchema,
  activatingMetadataSchema,
}: EmailAuthConfigViewProps) {
  const { t } = useI18n();
  const email = config.email ?? {};
  const magic = config.magic_link ?? {};
  const password = config.password ?? {};
  const policy = password.policy ?? {};
  const verification = config.verification ?? {};
  const metadataSchema = config.metadata_schema;

  return (
    <div className="space-y-6">
      {config.identifier && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{t('emailAuth.identifier')}</span>
          <Badge variant="tonal" tone="neutral" className="font-mono">
            {config.identifier}
          </Badge>
        </div>
      )}


      <div className="grid gap-4 md:grid-cols-2">
        <ConfigSection icon={<Mail className="w-4 h-4 text-sky-400" />} title={t('emailAuth.email')}>
          <ConfigRow label={t('emailAuth.active')} value={<BoolBadge value={email.enabled} />} />
          <ConfigRow label={t('emailAuth.allowPlusAlias')} value={<BoolBadge value={email.allow_plus_alias} />} />
          {email.normalize && (
            <div className="pt-2 mt-2 border-t border-border/50">
              <div className="text-xs text-muted-foreground mb-1">{t('emailAuth.normalization')}</div>
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

        <ConfigSection icon={<Link2 className="w-4 h-4 text-violet-400" />} title={t('emailAuth.magicLink')}>
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
                : <span className="text-muted-foreground">—</span>
            }
          />
          <ConfigRow
            label={t('emailAuth.defaultRedirectPath')}
            value={<span className="font-mono text-xs">{magic.default_redirect_path || '—'}</span>}
          />

          {magic.email_branding && (
            <div className="pt-3 mt-2 border-t border-border/50 space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                <Palette className="w-3.5 h-3.5" />
                {t('emailAuth.branding')}
              </div>
              <ConfigRow
                label={t('emailAuth.fromName')}
                value={<span className="font-mono text-xs">{magic.email_branding.from_name || '—'}</span>}
              />
              <ConfigRow
                label={t('emailAuth.subject')}
                value={<span className="font-mono text-xs">{magic.email_branding.subject || '—'}</span>}
              />
              <ConfigRow
                label={t('emailAuth.logoUrl')}
                value={
                  magic.email_branding.logo_url
                    ? <span className="font-mono text-xs truncate max-w-[200px] inline-block align-bottom">{magic.email_branding.logo_url}</span>
                    : <span className="text-muted-foreground">—</span>
                }
              />
              <ConfigRow
                label={t('emailAuth.buttonColor')}
                value={
                  magic.email_branding.button_color ? (
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="w-4 h-4 rounded border border-border"
                        style={{ backgroundColor: magic.email_branding.button_color }}
                      />
                      <span className="font-mono text-xs">{magic.email_branding.button_color}</span>
                    </span>
                  ) : <span className="text-muted-foreground">—</span>
                }
              />
            </div>
          )}

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

        <ConfigSection icon={<Lock className="w-4 h-4 text-amber-400" />} title={t('emailAuth.password')}>
          <ConfigRow label={t('emailAuth.active')} value={<BoolBadge value={password.enabled} />} />
          {policy && (
            <div className="pt-2 mt-2 space-y-1 border-t border-border/50">
              <div className="text-xs text-muted-foreground mb-1">{t('emailAuth.policy')}</div>
              <ConfigRow label={t('emailAuth.minLength')} value={<span className="font-mono">{policy.min_length ?? '—'}</span>} />
              <ConfigRow label={t('emailAuth.maxLength')} value={<span className="font-mono">{policy.max_length ?? '—'}</span>} />
              <ConfigRow label={t('emailAuth.minUppercase')} value={<span className="font-mono">{policy.min_uppercase ?? '—'}</span>} />
              <ConfigRow label={t('emailAuth.minLowercase')} value={<span className="font-mono">{policy.min_lowercase ?? '—'}</span>} />
              <ConfigRow label={t('emailAuth.minDigits')} value={<span className="font-mono">{policy.min_digits ?? '—'}</span>} />
              <ConfigRow label={t('emailAuth.minSpecialChar')} value={<span className="font-mono">{policy.min_special_char ?? '—'}</span>} />
              {policy.special_chars && policy.special_chars.length > 0 && (
                <ConfigRow
                  label={t('emailAuth.specialChars')}
                  value={
                    <span className="font-mono text-xs">
                      [{policy.special_chars.join(', ')}]
                    </span>
                  }
                />
              )}
              <ConfigRow
                label={t('emailAuth.denyCommonPasswords')}
                value={<BoolBadge value={policy.deny_common_passwords} />}
              />
            </div>
          )}
        </ConfigSection>

        <ConfigSection icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />} title={t('emailAuth.verification')}>
          <ConfigRow label={t('emailAuth.active')} value={<BoolBadge value={verification.enabled} />} />
          <ConfigRow label={t('emailAuth.mode')} value={<span className="font-mono">{verification.mode ?? '—'}</span>} />
          <ConfigRow label={t('emailAuth.codeSize')} value={<span className="font-mono">{verification.code_size ?? '—'}</span>} />
          <ConfigRow label={t('emailAuth.codeType')} value={<span className="font-mono">{verification.code_type ?? '—'}</span>} />
          <ConfigRow label={t('emailAuth.ttlSec')} value={<span className="font-mono">{verification.ttl_seconds ?? '—'}</span>} />
          <ConfigRow
            label={t('emailAuth.codeStrategy')}
            value={
              <Badge
                variant="tonal"
                tone={(verification.code_strategy ?? 'random') === 'fixed' ? 'warning' : 'success'}
                className="font-mono text-xs"
              >
                {verification.code_strategy ?? 'random'}
              </Badge>
            }
          />
          {verification.code_strategy === 'fixed' && (
            <ConfigRow
              label={t('emailAuth.fixedCode')}
              value={<span className="font-mono text-amber-400">{verification.fixed_code || '—'}</span>}
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
      </div>

      {metadataSchema && (
        <ConfigSection icon={<Database className="w-4 h-4 text-indigo-400" />} title={t('emailAuth.metadataSchema')}>
          <ConfigRow label={t('emailAuth.active')} value={<BoolBadge value={metadataSchema.enabled} />} />
          <ConfigRow
            label={t('emailAuth.metadataAdditionalProps')}
            value={<BoolBadge value={metadataSchema.additional_properties} />}
          />
          {metadataSchema.scheme && metadataSchema.scheme.length > 0 && (
            <div className="pt-2 mt-2 border-t border-border/50 space-y-2">
              <div className="text-xs text-muted-foreground mb-2">{t('emailAuth.metadataFields')}</div>
              {metadataSchema.scheme.map((field) => (
                <div key={field.name} className="flex items-center justify-between gap-2 py-1 pl-2 border-l-2 border-indigo-500/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs text-foreground truncate">{field.name}</span>
                    <Badge variant="outline" className="text-[10px] font-mono shrink-0">{field.type}</Badge>
                    {field.required && (
                      <Badge variant="tonal" tone="danger" className="text-[10px] shrink-0">
                        {t('emailAuth.metadataRequired')}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 text-[10px] text-muted-foreground">
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
      )}
    </div>
  );
}
