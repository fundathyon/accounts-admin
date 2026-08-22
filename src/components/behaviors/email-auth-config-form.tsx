'use client';

import { useMemo, useState } from 'react';
import { Mail, Link2, Lock, ShieldCheck, Info, AlertTriangle, Palette, Database, Plus, Trash2 } from 'lucide-react';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    FormField,
    IconButton,
    Input,
    Select,
    Switch,
    Text,
    Tooltip,
} from '@foundathyon/community-ui';
import { useI18n } from '@/context/i18n-context';
import type { MetadataFieldSchema } from '@/lib/admin-types';
import { cn } from '@/lib/utils';
import { FIXED_CODE_ALLOWED_ENVS, type EmailAuthConfig } from './email-auth-config-view';

const FIXED_CODE_CONFIRM_PHRASE = 'USAR CODIGO FIJO PARA TESTING';

interface EmailAuthConfigFormProps {
    initialConfig: EmailAuthConfig;
    onSave: (config: EmailAuthConfig) => void;
    onCancel: () => void;
    isSubmitting?: boolean;
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
                <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
            </Tooltip>
        </span>
    );
}

export function EmailAuthConfigForm({
    initialConfig,
    onSave,
    onCancel,
    isSubmitting,
}: EmailAuthConfigFormProps) {
    const { t } = useI18n();
    const [config, setConfig] = useState<EmailAuthConfig>(JSON.parse(JSON.stringify(initialConfig)));
    const [activeTab, setActiveTab] = useState<'email' | 'password' | 'magic' | 'verification' | 'metadata'>('email');
    const [pendingFixed, setPendingFixed] = useState(false);
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

    const handleStrategyChange = (next: 'random' | 'fixed') => {
        const current = config.verification?.code_strategy ?? 'random';
        if (next === 'fixed' && current !== 'fixed') {
            setConfirmInput('');
            setPendingFixed(true);
            return;
        }
        setConfig((prev) => ({
            ...prev,
            verification: {
                ...prev.verification,
                code_strategy: next,
                ...(next === 'random' ? { fixed_code: '' } : {}),
            },
        }));
    };

    const confirmSwitchToFixed = () => {
        if (confirmInput.trim() !== FIXED_CODE_CONFIRM_PHRASE) return;
        updateSubConfig('verification', 'code_strategy', 'fixed');
        setPendingFixed(false);
    };

    type BrandingField = keyof NonNullable<NonNullable<EmailAuthConfig['magic_link']>['email_branding']>;
    const updateBranding = (field: BrandingField, value: string) => {
        setConfig((prev) => ({
            ...prev,
            magic_link: {
                ...prev.magic_link,
                email_branding: {
                    ...(prev.magic_link?.email_branding ?? {}),
                    [field]: value,
                },
            },
        }));
    };

    const baseUrl = config.magic_link?.redirect_base_url ?? '';
    const baseUrlError = useMemo(() => {
        if (!baseUrl) return null;
        return /^https:\/\/[^/\s]+$/.test(baseUrl) ? null : t('emailAuth.errors.invalidBaseUrl');
    }, [baseUrl, t]);

    const defaultPath = config.magic_link?.default_redirect_path ?? '';
    const defaultPathError = useMemo(() => {
        if (!defaultPath) return null;
        const ok =
            defaultPath.startsWith('/') &&
            !defaultPath.startsWith('//') &&
            !defaultPath.includes(':') &&
            defaultPath.length <= 512;
        return ok ? null : t('emailAuth.errors.invalidRedirectPath');
    }, [defaultPath, t]);

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

    const tabs = [
        { id: 'email', icon: Mail, label: t('emailAuth.email') },
        { id: 'password', icon: Lock, label: t('emailAuth.password') },
        { id: 'magic', icon: Link2, label: t('emailAuth.magicLink') },
        { id: 'verification', icon: ShieldCheck, label: t('emailAuth.verification') },
        { id: 'metadata', icon: Database, label: t('emailAuth.metadataSchema') },
    ];

    const metadataSchema = config.metadata_schema ?? { enabled: false, scheme: [], additional_properties: false };

    const updateMetadataSchema = (field: string, value: unknown) => {
        setConfig((prev) => ({
            ...prev,
            metadata_schema: {
                enabled: prev.metadata_schema?.enabled ?? false,
                scheme: prev.metadata_schema?.scheme ?? [],
                additional_properties: prev.metadata_schema?.additional_properties ?? false,
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
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                            "flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-[2px] whitespace-nowrap",
                            activeTab === tab.id
                                ? "border-accent-border text-accent"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <tab.icon className="w-3.5 h-3.5 shrink-0" />
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                {activeTab === 'email' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-200">
                        <div className="p-4 rounded-xl border bg-muted/30">
                            <Switch
                                label={t('emailAuth.active')}
                                description="Habilita el inicio de sesión con email"
                                checked={config.email?.enabled}
                                onCheckedChange={(val) => updateSubConfig('email', 'enabled', val)}
                            />
                        </div>
                        <div className="p-4 rounded-xl border bg-muted/30">
                            <Switch
                                label={t('emailAuth.allowPlusAlias')}
                                description="Permitir alias con el signo + (ej: user+test@gmail.com)"
                                checked={config.email?.allow_plus_alias}
                                onCheckedChange={(val) => updateSubConfig('email', 'allow_plus_alias', val)}
                            />
                        </div>
                        <div className="p-4 rounded-xl border bg-muted/30 space-y-4">
                            <Text as="div" variant="label" tone="muted" className="text-xs uppercase tracking-wider">
                                {t('emailAuth.normalization')}
                            </Text>
                            <Switch
                                label="Lowercase"
                                checked={config.email?.normalize?.lowercase}
                                onCheckedChange={(val) => setConfig(prev => ({
                                    ...prev,
                                    email: { ...prev.email, normalize: { ...prev.email?.normalize, lowercase: val } }
                                }))}
                            />
                            <Switch
                                label="Trim"
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
                        <div className="p-4 rounded-xl border bg-muted/30">
                            <Switch
                                label={t('emailAuth.active')}
                                description="Permite autenticación por contraseña"
                                checked={config.password?.enabled}
                                onCheckedChange={(val) => updateSubConfig('password', 'enabled', val)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField label={t('emailAuth.minLength')}>
                                <Input
                                    type="number"
                                    value={config.password?.policy?.min_length || ''}
                                    onChange={(e) => updatePolicy('min_length', parseInt(e.target.value))}
                                />
                            </FormField>
                            <FormField label={t('emailAuth.maxLength')}>
                                <Input
                                    type="number"
                                    value={config.password?.policy?.max_length || ''}
                                    onChange={(e) => updatePolicy('max_length', parseInt(e.target.value))}
                                />
                            </FormField>
                            <FormField label={t('emailAuth.minUppercase')}>
                                <Input
                                    type="number"
                                    value={config.password?.policy?.min_uppercase || ''}
                                    onChange={(e) => updatePolicy('min_uppercase', parseInt(e.target.value))}
                                />
                            </FormField>
                            <FormField label={t('emailAuth.minLowercase')}>
                                <Input
                                    type="number"
                                    value={config.password?.policy?.min_lowercase || ''}
                                    onChange={(e) => updatePolicy('min_lowercase', parseInt(e.target.value))}
                                />
                            </FormField>
                            <FormField label={t('emailAuth.minDigits')}>
                                <Input
                                    type="number"
                                    value={config.password?.policy?.min_digits || ''}
                                    onChange={(e) => updatePolicy('min_digits', parseInt(e.target.value))}
                                />
                            </FormField>
                            <FormField label={t('emailAuth.minSpecialChar')}>
                                <Input
                                    type="number"
                                    value={config.password?.policy?.min_special_char || ''}
                                    onChange={(e) => updatePolicy('min_special_char', parseInt(e.target.value))}
                                />
                            </FormField>
                        </div>

                        <div className="p-4 rounded-xl border bg-muted/30">
                            <Switch
                                label={t('emailAuth.denyCommonPasswords')}
                                description="Bloquea contraseñas comunes (123456, password, etc)"
                                checked={config.password?.policy?.deny_common_passwords}
                                onCheckedChange={(val) => updatePolicy('deny_common_passwords', val)}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'magic' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-200">
                        <div className="p-4 rounded-xl border bg-muted/30">
                            <Switch
                                label={t('emailAuth.active')}
                                description={t('emailAuth.helpers.magicLinkActive')}
                                checked={config.magic_link?.enabled}
                                onCheckedChange={(val) => updateSubConfig('magic_link', 'enabled', val)}
                            />
                        </div>

                        <div className="p-4 rounded-xl border bg-muted/30">
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
                            error={baseUrlError ?? undefined}
                            description={t('emailAuth.helpers.redirectBaseUrl')}
                        >
                            <Input
                                value={config.magic_link?.redirect_base_url ?? ''}
                                onChange={(e) => updateSubConfig('magic_link', 'redirect_base_url', e.target.value)}
                                placeholder="https://lyron.lat"
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
                            error={defaultPathError ?? undefined}
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
                            <FormField label={t('emailAuth.ttlSec')}>
                                <Input
                                    type="number"
                                    value={config.magic_link?.ttl_seconds || ''}
                                    onChange={(e) => updateSubConfig('magic_link', 'ttl_seconds', parseInt(e.target.value))}
                                />
                            </FormField>
                            <FormField label={t('emailAuth.maxAttemptsWindow')}>
                                <Input
                                    type="number"
                                    value={config.magic_link?.max_attempts_per_window || ''}
                                    onChange={(e) => updateSubConfig('magic_link', 'max_attempts_per_window', parseInt(e.target.value))}
                                />
                            </FormField>
                            <FormField label={t('emailAuth.windowSec')}>
                                <Input
                                    type="number"
                                    value={config.magic_link?.window_seconds || ''}
                                    onChange={(e) => updateSubConfig('magic_link', 'window_seconds', parseInt(e.target.value))}
                                />
                            </FormField>
                        </div>
                        <p className="text-xs text-amber-400 flex items-start gap-1">
                            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>{t('emailAuth.helpers.rateLimit')}</span>
                        </p>

                        <div className="p-4 rounded-xl border bg-muted/30">
                            <Switch
                                label={t('emailAuth.singleUse')}
                                description="El link solo sirve para un uso"
                                checked={config.magic_link?.single_use}
                                onCheckedChange={(val) => updateSubConfig('magic_link', 'single_use', val)}
                            />
                        </div>

                        <div className="p-4 rounded-xl border bg-muted/30">
                            <Switch
                                label={t('emailAuth.bindToIp')}
                                description={t('emailAuth.helpers.bindToIp')}
                                checked={config.magic_link?.bind_to_ip}
                                onCheckedChange={(val) => updateSubConfig('magic_link', 'bind_to_ip', val)}
                            />
                        </div>

                        <div className="p-4 rounded-xl border bg-muted/30">
                            <Switch
                                label={t('emailAuth.bindToUserAgent')}
                                description={t('emailAuth.helpers.bindToUserAgent')}
                                checked={config.magic_link?.bind_to_user_agent}
                                onCheckedChange={(val) => updateSubConfig('magic_link', 'bind_to_user_agent', val)}
                            />
                        </div>

                        <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 space-y-4">
                            <div className="flex items-center gap-2">
                                <Palette className="w-4 h-4 text-violet-400" />
                                <Text as="span" variant="label" className="text-sm font-semibold">
                                    {t('emailAuth.branding')}
                                </Text>
                            </div>
                            <p className="text-xs text-muted-foreground -mt-2">{t('emailAuth.helpers.branding')}</p>

                            <div className="grid grid-cols-2 gap-4">
                                <FormField label={t('emailAuth.fromName')}>
                                    <Input
                                        value={config.magic_link?.email_branding?.from_name ?? ''}
                                        onChange={(e) => updateBranding('from_name', e.target.value)}
                                        placeholder="Lyron"
                                    />
                                </FormField>
                                <FormField label={t('emailAuth.subject')}>
                                    <Input
                                        value={config.magic_link?.email_branding?.subject ?? ''}
                                        onChange={(e) => updateBranding('subject', e.target.value)}
                                        placeholder="Tu acceso a Lyron"
                                    />
                                </FormField>
                            </div>

                            <FormField label={t('emailAuth.logoUrl')}>
                                <Input
                                    value={config.magic_link?.email_branding?.logo_url ?? ''}
                                    onChange={(e) => updateBranding('logo_url', e.target.value)}
                                    placeholder="https://lyron.lat/logo.png"
                                    className="font-mono"
                                />
                            </FormField>

                            <FormField label={t('emailAuth.buttonColor')}>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={config.magic_link?.email_branding?.button_color ?? '#7c3aed'}
                                        onChange={(e) => updateBranding('button_color', e.target.value)}
                                        className="w-12 h-9 rounded-md border border-border bg-background cursor-pointer p-0"
                                    />
                                    <Input
                                        value={config.magic_link?.email_branding?.button_color ?? ''}
                                        onChange={(e) => updateBranding('button_color', e.target.value)}
                                        placeholder="#7c3aed"
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
                        <div className="p-4 rounded-xl border bg-muted/30">
                            <Switch
                                label={
                                    <span className="flex items-center gap-2">
                                        {t('emailAuth.active')}
                                        <HintIcon text={t('emailAuth.tooltips.verificationActive')} className="max-w-xs" />
                                    </span>
                                }
                                description="Obliga a verificar el email antes de entrar"
                                checked={config.verification?.enabled}
                                onCheckedChange={(val) => updateSubConfig('verification', 'enabled', val)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                label={
                                    <>
                                        {t('emailAuth.codeSize')}
                                        <HintIcon text={t('emailAuth.tooltips.codeSize')} className="max-w-xs" />
                                    </>
                                }
                            >
                                <Input
                                    type="number"
                                    value={config.verification?.code_size || ''}
                                    onChange={(e) => updateSubConfig('verification', 'code_size', parseInt(e.target.value))}
                                />
                            </FormField>
                            <FormField
                                label={
                                    <>
                                        {t('emailAuth.ttlSec')}
                                        <HintIcon text={t('emailAuth.tooltips.ttlSec')} className="max-w-xs" />
                                    </>
                                }
                            >
                                <Input
                                    type="number"
                                    value={config.verification?.ttl_seconds || ''}
                                    onChange={(e) => updateSubConfig('verification', 'ttl_seconds', parseInt(e.target.value))}
                                />
                            </FormField>
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
                                placeholder="Select type"
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
                                onValueChange={(val) => handleStrategyChange(val as 'random' | 'fixed')}
                                className="w-full"
                                items={[
                                    { value: 'random', label: t('emailAuth.strategy.random') },
                                    { value: 'fixed', label: t('emailAuth.strategy.fixed') },
                                ]}
                            />
                        </FormField>

                        {config.verification?.code_strategy === 'fixed' && (
                            <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/5">
                                <FormField
                                    label={
                                        <>
                                            <span className="text-amber-700 dark:text-amber-400">
                                                {t('emailAuth.fixedCode')}
                                            </span>
                                            <HintIcon text={t('emailAuth.tooltips.fixedCode')} className="max-w-sm" />
                                        </>
                                    }
                                    description={
                                        <span className="text-amber-700 dark:text-amber-400 flex items-start gap-1">
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
                                value={config.verification?.mode || ''}
                                readOnly
                                className="text-muted-foreground cursor-not-allowed"
                            />
                        </FormField>
                    </div>
                )}

                {activeTab === 'metadata' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-200">
                        <div className="p-4 rounded-xl border bg-muted/30">
                            <Switch
                                label={t('emailAuth.active')}
                                description={t('emailAuth.metadataSchemaHelp')}
                                checked={metadataSchema.enabled}
                                onCheckedChange={(val) => updateMetadataSchema('enabled', val)}
                            />
                        </div>

                        <div className="p-4 rounded-xl border bg-muted/30">
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
                                <p className="text-xs text-muted-foreground text-center py-6 border rounded-xl border-dashed">
                                    {t('emailAuth.metadataNoFields')}
                                </p>
                            )}

                            {(metadataSchema.scheme ?? []).map((field, idx) => (
                                <div key={idx} className="rounded-xl border bg-muted/20 p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                            {t('emailAuth.metadataField')} #{idx + 1}
                                        </span>
                                        <IconButton
                                            type="button"
                                            icon={Trash2}
                                            label={t('common.delete')}
                                            variant="ghost"
                                            onClick={() => removeMetadataField(idx)}
                                            className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 h-7 w-7 p-0"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <FormField label={<span className="text-xs">{t('emailAuth.metadataFieldName')}</span>}>
                                            <Input
                                                value={field.name}
                                                onChange={(e) => updateMetadataField(idx, 'name', e.target.value)}
                                                placeholder="phone_number"
                                                wrapperClassName="h-8"
                                                className="font-mono text-sm"
                                            />
                                        </FormField>
                                        <FormField label={<span className="text-xs">{t('emailAuth.metadataFieldType')}</span>}>
                                            <Select
                                                value={field.type}
                                                onValueChange={(val) => updateMetadataField(idx, 'type', val as MetadataFieldSchema['type'])}
                                                className="h-8 text-sm"
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
                                                    className="text-sm"
                                                />
                                            </FormField>
                                            <FormField label={<span className="text-xs">{t('emailAuth.metadataMaxLength')}</span>}>
                                                <Input
                                                    type="number"
                                                    value={field.max_length ?? ''}
                                                    onChange={(e) => updateMetadataField(idx, 'max_length', e.target.value ? parseInt(e.target.value) : undefined)}
                                                    wrapperClassName="h-8"
                                                    className="text-sm"
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
                                                    className="text-sm"
                                                />
                                            </FormField>
                                            <FormField label={<span className="text-xs">{t('emailAuth.metadataMaximum')}</span>}>
                                                <Input
                                                    type="number"
                                                    value={field.maximum ?? ''}
                                                    onChange={(e) => updateMetadataField(idx, 'maximum', e.target.value ? parseFloat(e.target.value) : undefined)}
                                                    wrapperClassName="h-8"
                                                    className="text-sm"
                                                />
                                            </FormField>
                                        </div>
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
                                                className="font-mono text-sm"
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
                    <Button variant="primary" onClick={() => onSave(config)} disabled={isSubmitting}>
                        {isSubmitting ? t('behaviors.saving') : t('behaviors.saveChanges')}
                    </Button>
                </Tooltip>
            </div>

            <Dialog open={pendingFixed} onOpenChange={(open) => { if (!open) setPendingFixed(false); }}>
                <DialogContent className="max-w-lg sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="w-5 h-5" />
                            {t('emailAuth.confirmFixed.title')}
                        </DialogTitle>
                        <DialogDescription render={<div className="space-y-3 pt-2" />}>
                            <p>{t('emailAuth.confirmFixed.warning')}</p>
                            <p className="font-medium">
                                {t('emailAuth.confirmFixed.allowedEnvs')}{' '}
                                <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                                    {FIXED_CODE_ALLOWED_ENVS.join(', ')}
                                </code>
                            </p>
                            <p>
                                {t('emailAuth.confirmFixed.typeToConfirm')}{' '}
                                <code className="font-mono font-semibold text-xs bg-muted px-1.5 py-0.5 rounded">
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
                        <Button variant="secondary" onClick={() => setPendingFixed(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="primary"
                            onClick={confirmSwitchToFixed}
                            disabled={confirmInput.trim() !== FIXED_CODE_CONFIRM_PHRASE}
                            className="bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500"
                        >
                            {t('emailAuth.confirmFixed.confirm')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
