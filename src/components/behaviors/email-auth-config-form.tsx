'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Mail, Link2, Lock, ShieldCheck, Info, AlertTriangle, Palette, Database, Plus, Trash2, KeyRound, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  Select,
  Switch,
  Text,
  Tooltip,
} from '@foundathyon/community-ui';
import { Button, IconButton } from '@/components/fdn/button';
import { useI18n } from '@/context/i18n-context';
import type { MetadataFieldSchema } from '@/lib/admin-types';
import { cn } from '@/lib/utils';
import {
    EMAIL_CODE_LIMITS,
    FIXED_CODE_ALLOWED_ENVS,
    METADATA_SCHEMA_DEFAULTS,
    SESSIONS_LIMITS,
    validateEmailCode,
    validateMagicLink,
    validateSessions,
    withEmailCodeDefaults,
    withSessionsDefaults,
    type ConfigIssue,
    type EmailAuthConfig,
} from '@/lib/behaviors';

const FIXED_CODE_CONFIRM_PHRASE = 'USAR CODIGO FIJO PARA TESTING';

export type EmailAuthTab = 'email' | 'password' | 'magic' | 'code' | 'verification' | 'sessions' | 'metadata';

interface EmailAuthConfigFormProps {
    initialConfig: EmailAuthConfig;
    /** In Pro the sessions are edited in the `tokens` behavior, so the tab is hidden. */
    sessionsEditable: boolean;
    initialTab?: EmailAuthTab;
    onSave: (config: EmailAuthConfig) => void;
    onCancel: () => void;
    isSubmitting?: boolean;
}

function toNumber(value: string): number | undefined {
    if (value.trim() === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Info icon that opens a Tooltip. Wrapped in a click-swallowing span so it can
 * live inside a Switch's label row (the whole row toggles the switch) without
 * an accidental toggle when the user clicks the hint.
 */
function HintIcon({ text, className }: { text: string; className?: string }) {
    return (
        <span className="inline-flex" onClick={(e) => e.preventDefault()}>
            <Tooltip content={text} className={cn('whitespace-normal', className)}>
                <Info className="w-3.5 h-3.5 text-text-muted cursor-help" />
            </Tooltip>
        </span>
    );
}

/** Numeric field: an empty box is unset (the backend keeps what it has), and 0 stays visible. */
function NumberField({
    label,
    value,
    onChange,
    error,
    description,
}: {
    label: ReactNode;
    value: number | undefined;
    onChange: (value: number | undefined) => void;
    error?: string;
    description?: string;
}) {
    return (
        <FormField label={label} error={error} description={description}>
            <Input
                type="number"
                value={value ?? ''}
                onChange={(e) => onChange(toNumber(e.target.value))}
            />
        </FormField>
    );
}

export function EmailAuthConfigForm({
    initialConfig,
    sessionsEditable,
    initialTab = 'email',
    onSave,
    onCancel,
    isSubmitting,
}: EmailAuthConfigFormProps) {
    const { t } = useI18n();
    const [config, setConfig] = useState<EmailAuthConfig>(() => {
        const copy: EmailAuthConfig = JSON.parse(JSON.stringify(initialConfig));
        return {
            ...copy,
            email_code: withEmailCodeDefaults(copy.email_code),
            sessions: withSessionsDefaults(copy.sessions),
        };
    });
    const [activeTab, setActiveTab] = useState<EmailAuthTab>(initialTab);
    const [pendingFixed, setPendingFixed] = useState<'verification' | 'email_code' | null>(null);
    const [confirmInput, setConfirmInput] = useState('');

    const updateSubConfig = (section: keyof EmailAuthConfig, field: string, value: any) => {
        setConfig((prev) => ({
            ...prev,
            [section]: {
                ...(prev[section] as any),
                [field]: value,
            },
        }));
    };

    const handleStrategyChange = (section: 'verification' | 'email_code', next: 'random' | 'fixed') => {
        const current = config[section]?.code_strategy ?? 'random';
        if (next === 'fixed' && current !== 'fixed') {
            setConfirmInput('');
            setPendingFixed(section);
            return;
        }
        setConfig((prev) => ({
            ...prev,
            [section]: {
                ...prev[section],
                code_strategy: next,
                ...(next === 'random' ? { fixed_code: '' } : {}),
            },
        }));
    };

    const confirmSwitchToFixed = () => {
        if (!pendingFixed || confirmInput.trim() !== FIXED_CODE_CONFIRM_PHRASE) return;
        updateSubConfig(pendingFixed, 'code_strategy', 'fixed');
        setPendingFixed(null);
    };

    type BrandingField = keyof NonNullable<NonNullable<EmailAuthConfig['magic_link']>['email_branding']>;
    const updateBranding = (section: 'magic_link' | 'email_code', field: BrandingField, value: string) => {
        setConfig((prev) => ({
            ...prev,
            [section]: {
                ...prev[section],
                email_branding: {
                    ...(prev[section]?.email_branding ?? {}),
                    [field]: value,
                },
            },
        }));
    };

    // Save stays disabled while a value would be refused: the generic PUT that
    // stores magic_link does not validate, and the activate endpoints answer
    // one error at a time.
    const issues = useMemo(() => ({
        magic: validateMagicLink(config.magic_link ?? {}),
        code: validateEmailCode(config.email_code ?? {}),
        sessions: sessionsEditable ? validateSessions(config.sessions ?? {}) : [],
    }), [config, sessionsEditable]);
    const issueText = (list: ConfigIssue[], field: string) => {
        const issue = list.find((i) => i.field === field);
        return issue ? t(issue.key, issue.params) : undefined;
    };
    const hasIssues = Object.values(issues).some((list) => list.length > 0);

    const updatePolicy = (field: string, value: any) => {
        setConfig((prev) => ({
            ...prev,
            password: {
                ...prev.password,
                policy: {
                    ...(prev.password?.policy as any),
                    [field]: value,
                },
            },
        }));
    };

    const tabs: { id: EmailAuthTab; icon: typeof Mail; label: string; hasError?: boolean }[] = [
        { id: 'email', icon: Mail, label: t('emailAuth.email') },
        { id: 'password', icon: Lock, label: t('emailAuth.password') },
        { id: 'magic', icon: Link2, label: t('emailAuth.magicLink'), hasError: issues.magic.length > 0 },
        { id: 'code', icon: KeyRound, label: t('emailAuth.emailCode.tab'), hasError: issues.code.length > 0 },
        { id: 'verification', icon: ShieldCheck, label: t('emailAuth.verification') },
        ...(sessionsEditable
            ? [{ id: 'sessions' as const, icon: RefreshCw, label: t('emailAuth.sessions.title'), hasError: issues.sessions.length > 0 }]
            : []),
        { id: 'metadata', icon: Database, label: t('emailAuth.metadataSchema') },
    ];

    const metadataSchema = config.metadata_schema ?? METADATA_SCHEMA_DEFAULTS;
    // A backend that predates the check does not send the field.
    const breachedSupported = typeof initialConfig.password?.policy?.check_breached === 'boolean';

    const updateMetadataSchema = (field: string, value: unknown) => {
        setConfig((prev) => ({
            ...prev,
            metadata_schema: {
                ...METADATA_SCHEMA_DEFAULTS,
                ...prev.metadata_schema,
                [field]: value,
            },
        }));
    };

    const addMetadataField = () => {
        const newField: MetadataFieldSchema = { name: '', type: 'string', required: false };
        updateMetadataSchema('scheme', [...(metadataSchema.scheme ?? []), newField]);
    };

    const removeMetadataField = (idx: number) => {
        const updated = (metadataSchema.scheme ?? []).filter((_, i) => i !== idx);
        updateMetadataSchema('scheme', updated);
    };

    const updateMetadataField = (idx: number, field: keyof MetadataFieldSchema, value: unknown) => {
        const updated = (metadataSchema.scheme ?? []).map((f, i) =>
            i === idx ? { ...f, [field]: value } : f
        );
        updateMetadataSchema('scheme', updated);
    };

    return (
        <div className="flex flex-col h-full max-h-[70vh]">
            <div className="flex border-b mb-6 overflow-x-auto no-scrollbar">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "flex items-center gap-1.5 px-4 py-3 text-body font-medium transition-colors border-b-2 -mb-[2px] whitespace-nowrap",
                            activeTab === tab.id
                                ? "border-accent-border text-accent"
                                : "border-transparent text-text-muted hover:text-text"
                        )}
                    >
                        <tab.icon className="w-3.5 h-3.5 shrink-0" />
                        {tab.label}
                        {tab.hasError && <span className="size-1.5 rounded-full bg-danger-solid" />}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                {activeTab === 'email' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-200">
                        <div className="p-4 rounded-lg border bg-bg-subtle/30">
                            <Switch
                                label={t('emailAuth.active')}
                                description={t('emailAuth.helpers.emailActive')}
                                checked={config.email?.enabled}
                                onCheckedChange={(val) => updateSubConfig('email', 'enabled', val)}
                            />
                        </div>
                        <div className="p-4 rounded-lg border bg-bg-subtle/30">
                            <Switch
                                label={t('emailAuth.allowPlusAlias')}
                                description={t('emailAuth.helpers.allowPlusAlias')}
                                checked={config.email?.allow_plus_alias}
                                onCheckedChange={(val) => updateSubConfig('email', 'allow_plus_alias', val)}
                            />
                        </div>
                        <div className="p-4 rounded-lg border bg-bg-subtle/30 space-y-4">
                            <Text as="div" variant="label" tone="muted" className="text-xs uppercase tracking-wider">
                                {t('emailAuth.normalization')}
                            </Text>
                            <Switch
                                label={t('emailAuth.lowercase')}
                                checked={config.email?.normalize?.lowercase}
                                onCheckedChange={(val) => setConfig(prev => ({
                                    ...prev,
                                    email: { ...prev.email, normalize: { ...prev.email?.normalize, lowercase: val } }
                                }))}
                            />
                            <Switch
                                label={t('emailAuth.trim')}
                                checked={config.email?.normalize?.trim}
                                onCheckedChange={(val) => setConfig(prev => ({
                                    ...prev,
                                    email: { ...prev.email, normalize: { ...prev.email?.normalize, trim: val } }
                                }))}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'password' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-200">
                        <div className="p-4 rounded-lg border bg-bg-subtle/30">
                            <Switch
                                label={t('emailAuth.active')}
                                description={t('emailAuth.helpers.passwordActive')}
                                checked={config.password?.enabled}
                                onCheckedChange={(val) => updateSubConfig('password', 'enabled', val)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <NumberField
                                label={t('emailAuth.minLength')}
                                value={config.password?.policy?.min_length}
                                onChange={(val) => updatePolicy('min_length', val)}
                            />
                            <NumberField
                                label={t('emailAuth.maxLength')}
                                value={config.password?.policy?.max_length}
                                onChange={(val) => updatePolicy('max_length', val)}
                            />
                            <NumberField
                                label={t('emailAuth.minUppercase')}
                                value={config.password?.policy?.min_uppercase}
                                onChange={(val) => updatePolicy('min_uppercase', val)}
                            />
                            <NumberField
                                label={t('emailAuth.minLowercase')}
                                value={config.password?.policy?.min_lowercase}
                                onChange={(val) => updatePolicy('min_lowercase', val)}
                            />
                            <NumberField
                                label={t('emailAuth.minDigits')}
                                value={config.password?.policy?.min_digits}
                                onChange={(val) => updatePolicy('min_digits', val)}
                            />
                            <NumberField
                                label={t('emailAuth.minSpecialChar')}
                                value={config.password?.policy?.min_special_char}
                                onChange={(val) => updatePolicy('min_special_char', val)}
                            />
                        </div>

                        <FormField label={t('emailAuth.specialChars')} description={t('emailAuth.helpers.specialChars')}>
                            <Input
                                value={(config.password?.policy?.special_chars ?? []).join(', ')}
                                onChange={(e) =>
                                    updatePolicy('special_chars', e.target.value.split(',').map((c) => c.trim()).filter(Boolean))
                                }
                                placeholder="*, &, $"
                                className="font-mono"
                            />
                        </FormField>

                        <div className="p-4 rounded-lg border bg-bg-subtle/30">
                            <Switch
                                label={t('emailAuth.denyCommonPasswords')}
                                description={t('emailAuth.helpers.denyCommon')}
                                checked={config.password?.policy?.deny_common_passwords}
                                onCheckedChange={(val) => updatePolicy('deny_common_passwords', val)}
                            />
                        </div>

                        {breachedSupported ? (
                            <div className="p-4 rounded-lg border bg-bg-subtle/30">
                                <Switch
                                    label={t('emailAuth.checkBreached')}
                                    description={t('emailAuth.helpers.checkBreached')}
                                    checked={config.password?.policy?.check_breached}
                                    onCheckedChange={(val) => updatePolicy('check_breached', val)}
                                />
                            </div>
                        ) : (
                            <p className="flex items-start gap-1 text-xs text-warning">
                                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                <span>{t('emailAuth.helpers.checkBreachedUpdate')}</span>
                            </p>
                        )}
                    </div>
                )}

                {activeTab === 'magic' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-200">
                        <div className="p-4 rounded-lg border bg-bg-subtle/30">
                            <Switch
                                label={t('emailAuth.active')}
                                description={t('emailAuth.helpers.magicLinkActive')}
                                checked={config.magic_link?.enabled}
                                onCheckedChange={(val) => updateSubConfig('magic_link', 'enabled', val)}
                            />
                        </div>

                        <div className="p-4 rounded-lg border bg-bg-subtle/30">
                            <Switch
                                label={
                                    <span className="flex items-center gap-2">
                                        {t('emailAuth.autoSignup')}
                                        <HintIcon text={t('emailAuth.tooltips.autoSignup')} className="max-w-xs" />
                                    </span>
                                }
                                description={t('emailAuth.helpers.autoSignup')}
                                checked={config.magic_link?.auto_signup ?? false}
                                onCheckedChange={(val) => updateSubConfig('magic_link', 'auto_signup', val)}
                            />
                        </div>

                        <FormField
                            label={
                                <>
                                    {t('emailAuth.redirectBaseUrl')}
                                    <HintIcon text={t('emailAuth.tooltips.redirectBaseUrl')} className="max-w-sm" />
                                </>
                            }
                            error={issueText(issues.magic, 'redirect_base_url')}
                            description={t('emailAuth.helpers.redirectBaseUrl')}
                        >
                            <Input
                                value={config.magic_link?.redirect_base_url ?? ''}
                                onChange={(e) => updateSubConfig('magic_link', 'redirect_base_url', e.target.value)}
                                placeholder="https://app.example.com"
                                className="font-mono"
                            />
                        </FormField>

                        <FormField
                            label={
                                <>
                                    {t('emailAuth.defaultRedirectPath')}
                                    <HintIcon text={t('emailAuth.tooltips.defaultRedirectPath')} className="max-w-sm" />
                                </>
                            }
                            error={issueText(issues.magic, 'default_redirect_path')}
                            description={t('emailAuth.helpers.defaultRedirectPath')}
                        >
                            <Input
                                value={config.magic_link?.default_redirect_path ?? ''}
                                onChange={(e) => updateSubConfig('magic_link', 'default_redirect_path', e.target.value)}
                                placeholder="/"
                                className="font-mono"
                            />
                        </FormField>

                        <div className="grid grid-cols-2 gap-4">
                            <NumberField
                                label={t('emailAuth.ttlSec')}
                                value={config.magic_link?.ttl_seconds}
                                onChange={(val) => updateSubConfig('magic_link', 'ttl_seconds', val)}
                                error={issueText(issues.magic, 'ttl_seconds')}
                            />
                            <NumberField
                                label={t('emailAuth.maxAttemptsWindow')}
                                value={config.magic_link?.max_attempts_per_window}
                                onChange={(val) => updateSubConfig('magic_link', 'max_attempts_per_window', val)}
                                error={issueText(issues.magic, 'max_attempts_per_window')}
                            />
                            <NumberField
                                label={t('emailAuth.windowSec')}
                                value={config.magic_link?.window_seconds}
                                onChange={(val) => updateSubConfig('magic_link', 'window_seconds', val)}
                                error={issueText(issues.magic, 'window_seconds')}
                            />
                        </div>
                        <p className="text-xs text-warning flex items-start gap-1">
                            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>{t('emailAuth.helpers.rateLimit')}</span>
                        </p>

                        <div className="p-4 rounded-lg border bg-bg-subtle/30">
                            <Switch
                                label={t('emailAuth.singleUse')}
                                description={t('emailAuth.helpers.singleUse')}
                                checked={config.magic_link?.single_use}
                                onCheckedChange={(val) => updateSubConfig('magic_link', 'single_use', val)}
                            />
                        </div>

                        <div className="p-4 rounded-lg border bg-bg-subtle/30">
                            <Switch
                                label={t('emailAuth.bindToIp')}
                                description={t('emailAuth.helpers.bindToIp')}
                                checked={config.magic_link?.bind_to_ip}
                                onCheckedChange={(val) => updateSubConfig('magic_link', 'bind_to_ip', val)}
                            />
                        </div>

                        <div className="p-4 rounded-lg border bg-bg-subtle/30">
                            <Switch
                                label={t('emailAuth.bindToUserAgent')}
                                description={t('emailAuth.helpers.bindToUserAgent')}
                                checked={config.magic_link?.bind_to_user_agent}
                                onCheckedChange={(val) => updateSubConfig('magic_link', 'bind_to_user_agent', val)}
                            />
                        </div>

                        <div className="rounded-lg border border-border bg-bg-subtle p-4 space-y-4">
                            <div className="flex items-center gap-2">
                                <Palette className="w-4 h-4 text-text-muted" />
                                <Text as="span" variant="label" className="text-body font-semibold">
                                    {t('emailAuth.branding')}
                                </Text>
                            </div>
                            <p className="text-xs text-text-muted -mt-2">{t('emailAuth.helpers.branding')}</p>

                            <div className="grid grid-cols-2 gap-4">
                                <FormField label={t('emailAuth.fromName')}>
                                    <Input
                                        value={config.magic_link?.email_branding?.from_name ?? ''}
                                        onChange={(e) => updateBranding('magic_link', 'from_name', e.target.value)}
                                        placeholder={t('emailAuth.placeholders.fromName')}
                                    />
                                </FormField>
                                <FormField label={t('emailAuth.subject')}>
                                    <Input
                                        value={config.magic_link?.email_branding?.subject ?? ''}
                                        onChange={(e) => updateBranding('magic_link', 'subject', e.target.value)}
                                        placeholder={t('emailAuth.placeholders.subject')}
                                    />
                                </FormField>
                            </div>

                            <FormField label={t('emailAuth.logoUrl')}>
                                <Input
                                    value={config.magic_link?.email_branding?.logo_url ?? ''}
                                    onChange={(e) => updateBranding('magic_link', 'logo_url', e.target.value)}
                                    placeholder="https://app.example.com/logo.png"
                                    className="font-mono"
                                />
                            </FormField>

                            <FormField label={t('emailAuth.buttonColor')}>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={config.magic_link?.email_branding?.button_color ?? '#7c3aed'}
                                        onChange={(e) => updateBranding('magic_link', 'button_color', e.target.value)}
                                        className="w-12 h-9 rounded-md border border-border bg-bg cursor-pointer p-0"
                                    />
                                    <Input
                                        value={config.magic_link?.email_branding?.button_color ?? ''}
                                        onChange={(e) => updateBranding('magic_link', 'button_color', e.target.value)}
                                        placeholder="#7c3aed"
                                        wrapperClassName="w-32"
                                        className="font-mono"
                                    />
                                </div>
                            </FormField>
                        </div>
                    </div>
                )}

                {activeTab === 'code' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-200">
                        <div className="p-4 rounded-lg border bg-bg-subtle/30">
                            <Switch
                                label={t('emailAuth.active')}
                                description={t('emailAuth.emailCode.activeHelp')}
                                checked={config.email_code?.enabled}
                                onCheckedChange={(val) => updateSubConfig('email_code', 'enabled', val)}
                            />
                        </div>

                        <div className="p-4 rounded-lg border bg-bg-subtle/30">
                            <Switch
                                label={t('emailAuth.autoSignup')}
                                description={t('emailAuth.emailCode.autoSignupHelp')}
                                checked={config.email_code?.auto_signup}
                                onCheckedChange={(val) => updateSubConfig('email_code', 'auto_signup', val)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <NumberField
                                label={t('emailAuth.emailCode.codeLengthRange', EMAIL_CODE_LIMITS.size)}
                                value={config.email_code?.code_size}
                                onChange={(val) => updateSubConfig('email_code', 'code_size', val)}
                                error={issueText(issues.code, 'code_size')}
                            />
                            <FormField label={t('emailAuth.codeType')}>
                                <Select
                                    value={config.email_code?.code_type ?? 'numeric'}
                                    onValueChange={(val) => val && updateSubConfig('email_code', 'code_type', val)}
                                    className="w-full"
                                    items={[
                                        { value: 'numeric', label: t('emailAuth.emailCode.typeNumeric') },
                                        { value: 'alphanumeric', label: t('emailAuth.emailCode.typeAlphanumeric') },
                                        { value: 'alphanumeric_special', label: t('emailAuth.emailCode.typeSpecial') },
                                    ]}
                                />
                            </FormField>
                        </div>
                        <p className="text-xs text-text-muted">{t('emailAuth.emailCode.defaultNote')}</p>

                        <div className="grid grid-cols-3 gap-4">
                            <NumberField
                                label={t('emailAuth.emailCode.validityRange', EMAIL_CODE_LIMITS.ttl)}
                                value={config.email_code?.ttl_seconds}
                                onChange={(val) => updateSubConfig('email_code', 'ttl_seconds', val)}
                                error={issueText(issues.code, 'ttl_seconds')}
                            />
                            <NumberField
                                label={t('emailAuth.emailCode.attemptsRange', EMAIL_CODE_LIMITS.attempts)}
                                value={config.email_code?.max_verify_attempts}
                                onChange={(val) => updateSubConfig('email_code', 'max_verify_attempts', val)}
                                error={issueText(issues.code, 'max_verify_attempts')}
                            />
                            <NumberField
                                label={t('emailAuth.emailCode.cooldownRange', { max: EMAIL_CODE_LIMITS.cooldownMax })}
                                value={config.email_code?.resend_cooldown_seconds}
                                onChange={(val) => updateSubConfig('email_code', 'resend_cooldown_seconds', val)}
                                error={issueText(issues.code, 'resend_cooldown_seconds')}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <NumberField
                                label={t('emailAuth.emailCode.maxSendsWindow')}
                                value={config.email_code?.max_attempts_per_window}
                                onChange={(val) => updateSubConfig('email_code', 'max_attempts_per_window', val)}
                                error={issueText(issues.code, 'max_attempts_per_window')}
                            />
                            <NumberField
                                label={t('emailAuth.windowSec')}
                                value={config.email_code?.window_seconds}
                                onChange={(val) => updateSubConfig('email_code', 'window_seconds', val)}
                                error={issueText(issues.code, 'window_seconds')}
                            />
                        </div>
                        <p className="text-xs text-warning flex items-start gap-1">
                            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>{t('emailAuth.emailCode.attemptsNote')}</span>
                        </p>

                        <FormField label={t('emailAuth.codeStrategy')} description={t('emailAuth.strategy.helper')}>
                            <Select
                                value={config.email_code?.code_strategy ?? 'random'}
                                onValueChange={(val) => handleStrategyChange('email_code', val as 'random' | 'fixed')}
                                className="w-full"
                                items={[
                                    { value: 'random', label: t('emailAuth.strategy.random') },
                                    { value: 'fixed', label: t('emailAuth.strategy.fixed') },
                                ]}
                            />
                        </FormField>

                        {config.email_code?.code_strategy === 'fixed' && (
                            <div className="p-4 rounded-lg border border-warning-border bg-warning-bg">
                                <FormField
                                    label={<span className="text-warning">{t('emailAuth.fixedCode')}</span>}
                                    error={issueText(issues.code, 'fixed_code')}
                                    description={
                                        <span className="text-warning flex items-start gap-1">
                                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                            <span>{t('emailAuth.emailCode.fixedWarning')}</span>
                                        </span>
                                    }
                                >
                                    <Input
                                        value={config.email_code?.fixed_code ?? ''}
                                        onChange={(e) => updateSubConfig('email_code', 'fixed_code', e.target.value)}
                                        placeholder="123456"
                                        className="font-mono"
                                    />
                                </FormField>
                            </div>
                        )}

                        <div className="p-4 rounded-lg border bg-bg-subtle/30">
                            <Switch
                                label={t('emailAuth.emailCode.singleActiveCode')}
                                description={t('emailAuth.emailCode.singleActiveCodeHelp')}
                                checked={config.email_code?.single_active_code}
                                onCheckedChange={(val) => updateSubConfig('email_code', 'single_active_code', val)}
                            />
                        </div>

                        <div className="p-4 rounded-lg border bg-bg-subtle/30">
                            <Switch
                                label={t('emailAuth.bindToIp')}
                                description={t('emailAuth.emailCode.bindToIpHelp')}
                                checked={config.email_code?.bind_to_ip}
                                onCheckedChange={(val) => updateSubConfig('email_code', 'bind_to_ip', val)}
                            />
                        </div>

                        <div className="p-4 rounded-lg border bg-bg-subtle/30">
                            <Switch
                                label={t('emailAuth.bindToUserAgent')}
                                description={t('emailAuth.emailCode.bindToUserAgentHelp')}
                                checked={config.email_code?.bind_to_user_agent}
                                onCheckedChange={(val) => updateSubConfig('email_code', 'bind_to_user_agent', val)}
                            />
                        </div>

                        <div className="rounded-lg border border-border bg-bg-subtle p-4 space-y-4">
                            <div className="flex items-center gap-2">
                                <Palette className="w-4 h-4 text-text-muted" />
                                <Text as="span" variant="label" className="text-body font-semibold">
                                    {t('emailAuth.branding')}
                                </Text>
                            </div>
                            <p className="text-xs text-text-muted -mt-2">{t('emailAuth.helpers.branding')}</p>

                            <div className="grid grid-cols-2 gap-4">
                                <FormField label={t('emailAuth.fromName')}>
                                    <Input
                                        value={config.email_code?.email_branding?.from_name ?? ''}
                                        onChange={(e) => updateBranding('email_code', 'from_name', e.target.value)}
                                        placeholder={t('emailAuth.placeholders.fromName')}
                                    />
                                </FormField>
                                <FormField label={t('emailAuth.subject')}>
                                    <Input
                                        value={config.email_code?.email_branding?.subject ?? ''}
                                        onChange={(e) => updateBranding('email_code', 'subject', e.target.value)}
                                        placeholder={t('emailAuth.placeholders.codeSubject')}
                                    />
                                </FormField>
                            </div>

                            <FormField label={t('emailAuth.logoUrl')}>
                                <Input
                                    value={config.email_code?.email_branding?.logo_url ?? ''}
                                    onChange={(e) => updateBranding('email_code', 'logo_url', e.target.value)}
                                    placeholder="https://app.example.com/logo.png"
                                    className="font-mono"
                                />
                            </FormField>

                            <FormField label={t('emailAuth.buttonColor')}>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={config.email_code?.email_branding?.button_color || '#000000'}
                                        onChange={(e) => updateBranding('email_code', 'button_color', e.target.value)}
                                        className="w-12 h-9 rounded-md border border-border bg-bg cursor-pointer p-0"
                                    />
                                    <Input
                                        value={config.email_code?.email_branding?.button_color ?? ''}
                                        onChange={(e) => updateBranding('email_code', 'button_color', e.target.value)}
                                        placeholder="#000000"
                                        wrapperClassName="w-32"
                                        className="font-mono"
                                    />
                                </div>
                            </FormField>
                        </div>
                    </div>
                )}

                {activeTab === 'verification' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-200">
                        <div className="p-4 rounded-lg border bg-bg-subtle/30">
                            <Switch
                                label={
                                    <span className="flex items-center gap-2">
                                        {t('emailAuth.active')}
                                        <HintIcon text={t('emailAuth.tooltips.verificationActive')} className="max-w-xs" />
                                    </span>
                                }
                                description={t('emailAuth.helpers.verificationActive')}
                                checked={config.verification?.enabled}
                                onCheckedChange={(val) => updateSubConfig('verification', 'enabled', val)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <NumberField
                                label={
                                    <>
                                        {t('emailAuth.codeSize')}
                                        <HintIcon text={t('emailAuth.tooltips.codeSize')} className="max-w-xs" />
                                    </>
                                }
                                value={config.verification?.code_size}
                                onChange={(val) => updateSubConfig('verification', 'code_size', val)}
                            />
                            <NumberField
                                label={
                                    <>
                                        {t('emailAuth.ttlSec')}
                                        <HintIcon text={t('emailAuth.tooltips.ttlSec')} className="max-w-xs" />
                                    </>
                                }
                                value={config.verification?.ttl_seconds}
                                onChange={(val) => updateSubConfig('verification', 'ttl_seconds', val)}
                            />
                        </div>

                        <FormField
                            label={
                                <>
                                    {t('emailAuth.codeType')}
                                    <HintIcon text={t('emailAuth.tooltips.codeType')} className="max-w-xs" />
                                </>
                            }
                        >
                            <Select
                                value={config.verification?.code_type || 'numeric'}
                                onValueChange={(val) => updateSubConfig('verification', 'code_type', val)}
                                placeholder={t('emailAuth.codeType')}
                                className="w-full"
                                items={[
                                    { value: 'numeric', label: 'numeric' },
                                    { value: 'alphanumeric', label: 'alphanumeric' },
                                ]}
                            />
                        </FormField>

                        <FormField
                            label={
                                <>
                                    {t('emailAuth.codeStrategy')}
                                    <HintIcon text={t('emailAuth.tooltips.codeStrategy')} className="max-w-sm" />
                                </>
                            }
                            description={t('emailAuth.strategy.helper')}
                        >
                            <Select
                                value={config.verification?.code_strategy ?? 'random'}
                                onValueChange={(val) => handleStrategyChange('verification', val as 'random' | 'fixed')}
                                className="w-full"
                                items={[
                                    { value: 'random', label: t('emailAuth.strategy.random') },
                                    { value: 'fixed', label: t('emailAuth.strategy.fixed') },
                                ]}
                            />
                        </FormField>

                        {config.verification?.code_strategy === 'fixed' && (
                            <div className="p-4 rounded-lg border border-warning-border bg-warning-bg">
                                <FormField
                                    label={
                                        <>
                                            <span className="text-warning">
                                                {t('emailAuth.fixedCode')}
                                            </span>
                                            <HintIcon text={t('emailAuth.tooltips.fixedCode')} className="max-w-sm" />
                                        </>
                                    }
                                    description={
                                        <span className="text-warning flex items-start gap-1">
                                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                            <span>{t('emailAuth.strategy.fixedWarning')}</span>
                                        </span>
                                    }
                                >
                                    <Input
                                        value={config.verification?.fixed_code ?? ''}
                                        onChange={(e) => updateSubConfig('verification', 'fixed_code', e.target.value)}
                                        placeholder="123456"
                                        className="font-mono"
                                    />
                                </FormField>
                            </div>
                        )}

                        <FormField label={t('emailAuth.mode')}>
                            <Input
                                value={config.verification?.mode ?? ''}
                                onChange={(e) => updateSubConfig('verification', 'mode', e.target.value)}
                                placeholder="email_code"
                                className="font-mono"
                            />
                        </FormField>
                    </div>
                )}

                {activeTab === 'sessions' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-200">
                        <div className="p-4 rounded-lg border bg-bg-subtle/30">
                            <Switch
                                label={t('emailAuth.sessions.rotation')}
                                description={t('emailAuth.sessions.rotationHelp')}
                                checked={config.sessions?.refresh_rotation}
                                onCheckedChange={(val) => updateSubConfig('sessions', 'refresh_rotation', val)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <NumberField
                                label={t('emailAuth.sessions.reuseInterval')}
                                description={t('emailAuth.sessions.reuseIntervalHelp', { max: SESSIONS_LIMITS.reuseMax })}
                                value={config.sessions?.reuse_interval_seconds}
                                onChange={(val) => updateSubConfig('sessions', 'reuse_interval_seconds', val)}
                                error={issueText(issues.sessions, 'reuse_interval_seconds')}
                            />
                            <NumberField
                                label={t('emailAuth.sessions.idleTimeout')}
                                description={t('emailAuth.sessions.idleTimeoutHelp', SESSIONS_LIMITS.idle)}
                                value={config.sessions?.idle_timeout_seconds}
                                onChange={(val) => updateSubConfig('sessions', 'idle_timeout_seconds', val)}
                                error={issueText(issues.sessions, 'idle_timeout_seconds')}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'metadata' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-200">
                        <div className="p-4 rounded-lg border bg-bg-subtle/30">
                            <Switch
                                label={t('emailAuth.active')}
                                description={t('emailAuth.metadataSchemaHelp')}
                                checked={metadataSchema.enabled}
                                onCheckedChange={(val) => updateMetadataSchema('enabled', val)}
                            />
                        </div>

                        <div className="p-4 rounded-lg border bg-bg-subtle/30">
                            <Switch
                                label={t('emailAuth.metadataAdditionalProps')}
                                description={t('emailAuth.metadataAdditionalPropsHelp')}
                                checked={metadataSchema.additional_properties}
                                onCheckedChange={(val) => updateMetadataSchema('additional_properties', val)}
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Text as="span" variant="label" tone="muted" className="text-xs uppercase tracking-wider">
                                    {t('emailAuth.metadataFields')}
                                </Text>
                                <Button type="button" variant="secondary" size="sm" onClick={addMetadataField} className="gap-2">
                                    <Plus className="w-3.5 h-3.5" />
                                    {t('emailAuth.metadataAddField')}
                                </Button>
                            </div>

                            {(metadataSchema.scheme ?? []).length === 0 && (
                                <p className="text-xs text-text-muted text-center py-6 border rounded-lg border-dashed">
                                    {t('emailAuth.metadataNoFields')}
                                </p>
                            )}

                            {(metadataSchema.scheme ?? []).map((field, idx) => (
                                <div key={idx} className="rounded-lg border bg-bg-subtle/20 p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                                            {t('emailAuth.metadataField')} #{idx + 1}
                                        </span>
                                        <IconButton
                                            type="button"
                                            icon={Trash2}
                                            label={t('common.delete')}
                                            variant="ghost"
                                            onClick={() => removeMetadataField(idx)}
                                            className="text-danger hover:text-danger hover:bg-danger-bg h-7 w-7 p-0"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <FormField label={<span className="text-xs">{t('emailAuth.metadataFieldName')}</span>}>
                                            <Input
                                                value={field.name}
                                                onChange={(e) => updateMetadataField(idx, 'name', e.target.value)}
                                                placeholder="phone_number"
                                                wrapperClassName="h-8"
                                                className="font-mono text-body"
                                            />
                                        </FormField>
                                        <FormField label={<span className="text-xs">{t('emailAuth.metadataFieldType')}</span>}>
                                            <Select
                                                value={field.type}
                                                onValueChange={(val) => updateMetadataField(idx, 'type', val as MetadataFieldSchema['type'])}
                                                className="h-8 text-body"
                                                items={[
                                                    { value: 'string', label: 'string' },
                                                    { value: 'number', label: 'number' },
                                                    { value: 'boolean', label: 'boolean' },
                                                ]}
                                            />
                                        </FormField>
                                    </div>
                                    <Switch
                                        label={<span className="text-xs">{t('emailAuth.metadataRequired')}</span>}
                                        checked={field.required}
                                        onCheckedChange={(val) => updateMetadataField(idx, 'required', val)}
                                    />
                                    {field.type === 'string' && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <FormField label={<span className="text-xs">{t('emailAuth.metadataMinLength')}</span>}>
                                                <Input
                                                    type="number"
                                                    value={field.min_length ?? ''}
                                                    onChange={(e) => updateMetadataField(idx, 'min_length', e.target.value ? parseInt(e.target.value) : undefined)}
                                                    wrapperClassName="h-8"
                                                    className="text-body"
                                                />
                                            </FormField>
                                            <FormField label={<span className="text-xs">{t('emailAuth.metadataMaxLength')}</span>}>
                                                <Input
                                                    type="number"
                                                    value={field.max_length ?? ''}
                                                    onChange={(e) => updateMetadataField(idx, 'max_length', e.target.value ? parseInt(e.target.value) : undefined)}
                                                    wrapperClassName="h-8"
                                                    className="text-body"
                                                />
                                            </FormField>
                                        </div>
                                    )}
                                    {field.type === 'number' && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <FormField label={<span className="text-xs">{t('emailAuth.metadataMinimum')}</span>}>
                                                <Input
                                                    type="number"
                                                    value={field.minimum ?? ''}
                                                    onChange={(e) => updateMetadataField(idx, 'minimum', e.target.value ? parseFloat(e.target.value) : undefined)}
                                                    wrapperClassName="h-8"
                                                    className="text-body"
                                                />
                                            </FormField>
                                            <FormField label={<span className="text-xs">{t('emailAuth.metadataMaximum')}</span>}>
                                                <Input
                                                    type="number"
                                                    value={field.maximum ?? ''}
                                                    onChange={(e) => updateMetadataField(idx, 'maximum', e.target.value ? parseFloat(e.target.value) : undefined)}
                                                    wrapperClassName="h-8"
                                                    className="text-body"
                                                />
                                            </FormField>
                                        </div>
                                    )}
                                    {field.type === 'string' && (
                                        <FormField
                                            label={<span className="text-xs">{t('emailAuth.metadataFormat')}</span>}
                                            description={<span className="text-[10px]">{t('emailAuth.metadataFormatHelp')}</span>}
                                        >
                                            <Input
                                                value={field.format ?? ''}
                                                onChange={(e) => updateMetadataField(idx, 'format', e.target.value || undefined)}
                                                placeholder="[0-9]{10}"
                                                wrapperClassName="h-8"
                                                className="font-mono text-body"
                                            />
                                        </FormField>
                                    )}
                                    {field.type === 'string' && (
                                        <FormField
                                            label={<span className="text-xs">{t('emailAuth.metadataEnum')}</span>}
                                            description={<span className="text-[10px]">{t('emailAuth.metadataEnumHelp')}</span>}
                                        >
                                            <Input
                                                value={(field.enum ?? []).join(', ')}
                                                onChange={(e) => {
                                                    const vals = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                                                    updateMetadataField(idx, 'enum', vals.length > 0 ? vals : undefined);
                                                }}
                                                placeholder="value1, value2, value3"
                                                wrapperClassName="h-8"
                                                className="font-mono text-body"
                                            />
                                        </FormField>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-4 border-t">
                <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
                    {t('common.cancel')}
                </Button>
                <Tooltip content={t('tooltips.saveSettings')}>
                    <Button variant="primary" onClick={() => onSave(config)} disabled={isSubmitting || hasIssues}>
                        {isSubmitting ? t('behaviors.saving') : t('behaviors.saveChanges')}
                    </Button>
                </Tooltip>
            </div>

            <Dialog open={pendingFixed !== null} onOpenChange={(open) => { if (!open) setPendingFixed(null); }}>
                <DialogContent className="max-w-lg sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-warning">
                            <AlertTriangle className="w-5 h-5" />
                            {t('emailAuth.confirmFixed.title')}
                        </DialogTitle>
                        <DialogDescription render={<div className="space-y-3 pt-2" />}>
                            <p>{t('emailAuth.confirmFixed.warning')}</p>
                            <p className="font-medium">
                                {t('emailAuth.confirmFixed.allowedEnvs')}{' '}
                                <code className="font-mono text-xs bg-bg-subtle px-1.5 py-0.5 rounded">
                                    {FIXED_CODE_ALLOWED_ENVS.join(', ')}
                                </code>
                            </p>
                            <p>
                                {t('emailAuth.confirmFixed.typeToConfirm')}{' '}
                                <code className="font-mono font-semibold text-xs bg-bg-subtle px-1.5 py-0.5 rounded">
                                    {FIXED_CODE_CONFIRM_PHRASE}
                                </code>
                            </p>
                        </DialogDescription>
                    </DialogHeader>

                    <Input
                        autoFocus
                        value={confirmInput}
                        onChange={(e) => setConfirmInput(e.target.value)}
                        placeholder={FIXED_CODE_CONFIRM_PHRASE}
                        className="font-mono"
                    />

                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setPendingFixed(null)}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmSwitchToFixed}
                            disabled={confirmInput.trim() !== FIXED_CODE_CONFIRM_PHRASE}
                        >
                            {t('emailAuth.confirmFixed.confirm')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
