'use client';

import { useState } from 'react';
import { Mail, Link2, Lock, ShieldCheck, Info, AlertTriangle } from 'lucide-react';
import { useI18n } from '@/context/i18n-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { FIXED_CODE_ALLOWED_ENVS, type EmailAuthConfig } from './email-auth-config-view';

const FIXED_CODE_CONFIRM_PHRASE = 'USAR CODIGO FIJO PARA TESTING';

interface EmailAuthConfigFormProps {
    initialConfig: EmailAuthConfig;
    onSave: (config: EmailAuthConfig) => void;
    onCancel: () => void;
    isSubmitting?: boolean;
}

export function EmailAuthConfigForm({
    initialConfig,
    onSave,
    onCancel,
    isSubmitting,
}: EmailAuthConfigFormProps) {
    const { t } = useI18n();
    const [config, setConfig] = useState<EmailAuthConfig>(JSON.parse(JSON.stringify(initialConfig)));
    const [activeTab, setActiveTab] = useState<'email' | 'password' | 'magic' | 'verification'>('email');
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
    ];

    return (
        <div className="flex flex-col h-full max-h-[70vh]">
            <div className="flex border-b mb-6 overflow-x-auto no-scrollbar">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-[2px] whitespace-nowrap",
                            activeTab === tab.id
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                {activeTab === 'email' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-200">
                        <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30">
                            <div className="space-y-0.5">
                                <Label>{t('emailAuth.active')}</Label>
                                <p className="text-xs text-muted-foreground">Habilita el inicio de sesión con email</p>
                            </div>
                            <Switch
                                checked={config.email?.enabled}
                                onCheckedChange={(val) => updateSubConfig('email', 'enabled', val)}
                            />
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30">
                            <div className="space-y-0.5">
                                <Label>{t('emailAuth.allowPlusAlias')}</Label>
                                <p className="text-xs text-muted-foreground">Permitir alias con el signo + (ej: user+test@gmail.com)</p>
                            </div>
                            <Switch
                                checked={config.email?.allow_plus_alias}
                                onCheckedChange={(val) => updateSubConfig('email', 'allow_plus_alias', val)}
                            />
                        </div>
                        <div className="p-4 rounded-xl border bg-muted/30 space-y-4">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">{t('emailAuth.normalization')}</Label>
                            <div className="flex items-center justify-between">
                                <Label>Lowercase</Label>
                                <Switch
                                    checked={config.email?.normalize?.lowercase}
                                    onCheckedChange={(val) => setConfig(prev => ({
                                        ...prev,
                                        email: { ...prev.email, normalize: { ...prev.email?.normalize, lowercase: val } }
                                    }))}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label>Trim</Label>
                                <Switch
                                    checked={config.email?.normalize?.trim}
                                    onCheckedChange={(val) => setConfig(prev => ({
                                        ...prev,
                                        email: { ...prev.email, normalize: { ...prev.email?.normalize, trim: val } }
                                    }))}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'password' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-200">
                        <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30">
                            <div className="space-y-0.5">
                                <Label>{t('emailAuth.active')}</Label>
                                <p className="text-xs text-muted-foreground">Permite autenticación por contraseña</p>
                            </div>
                            <Switch
                                checked={config.password?.enabled}
                                onCheckedChange={(val) => updateSubConfig('password', 'enabled', val)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>{t('emailAuth.minLength')}</Label>
                                <Input
                                    type="number"
                                    value={config.password?.policy?.min_length || ''}
                                    onChange={(e) => updatePolicy('min_length', parseInt(e.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('emailAuth.maxLength')}</Label>
                                <Input
                                    type="number"
                                    value={config.password?.policy?.max_length || ''}
                                    onChange={(e) => updatePolicy('max_length', parseInt(e.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('emailAuth.minUppercase')}</Label>
                                <Input
                                    type="number"
                                    value={config.password?.policy?.min_uppercase || ''}
                                    onChange={(e) => updatePolicy('min_uppercase', parseInt(e.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('emailAuth.minLowercase')}</Label>
                                <Input
                                    type="number"
                                    value={config.password?.policy?.min_lowercase || ''}
                                    onChange={(e) => updatePolicy('min_lowercase', parseInt(e.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('emailAuth.minDigits')}</Label>
                                <Input
                                    type="number"
                                    value={config.password?.policy?.min_digits || ''}
                                    onChange={(e) => updatePolicy('min_digits', parseInt(e.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('emailAuth.minSpecialChar')}</Label>
                                <Input
                                    type="number"
                                    value={config.password?.policy?.min_special_char || ''}
                                    onChange={(e) => updatePolicy('min_special_char', parseInt(e.target.value))}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30">
                            <div className="space-y-0.5">
                                <Label>{t('emailAuth.denyCommonPasswords')}</Label>
                                <p className="text-xs text-muted-foreground">Bloquea contraseñas comunes (123456, password, etc)</p>
                            </div>
                            <Switch
                                checked={config.password?.policy?.deny_common_passwords}
                                onCheckedChange={(val) => updatePolicy('deny_common_passwords', val)}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'magic' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-200">
                        <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30">
                            <div className="space-y-0.5">
                                <Label>{t('emailAuth.active')}</Label>
                                <p className="text-xs text-muted-foreground">Habilita inicio de sesión sin contraseña vía email</p>
                            </div>
                            <Switch
                                checked={config.magic_link?.enabled}
                                onCheckedChange={(val) => updateSubConfig('magic_link', 'enabled', val)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>{t('emailAuth.ttlSec')}</Label>
                                <Input
                                    type="number"
                                    value={config.magic_link?.ttl_seconds || ''}
                                    onChange={(e) => updateSubConfig('magic_link', 'ttl_seconds', parseInt(e.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('emailAuth.maxAttemptsWindow')}</Label>
                                <Input
                                    type="number"
                                    value={config.magic_link?.max_attempts_per_window || ''}
                                    onChange={(e) => updateSubConfig('magic_link', 'max_attempts_per_window', parseInt(e.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('emailAuth.windowSec')}</Label>
                                <Input
                                    type="number"
                                    value={config.magic_link?.window_seconds || ''}
                                    onChange={(e) => updateSubConfig('magic_link', 'window_seconds', parseInt(e.target.value))}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30">
                            <div className="space-y-0.5">
                                <Label>{t('emailAuth.singleUse')}</Label>
                                <p className="text-xs text-muted-foreground">El link solo sirve para un uso</p>
                            </div>
                            <Switch
                                checked={config.magic_link?.single_use}
                                onCheckedChange={(val) => updateSubConfig('magic_link', 'single_use', val)}
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30">
                            <div className="space-y-0.5">
                                <Label>{t('emailAuth.bindToIp')}</Label>
                                <p className="text-xs text-muted-foreground">El link solo funciona en la misma IP que lo solicitó</p>
                            </div>
                            <Switch
                                checked={config.magic_link?.bind_to_ip}
                                onCheckedChange={(val) => updateSubConfig('magic_link', 'bind_to_ip', val)}
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30">
                            <div className="space-y-0.5">
                                <Label>{t('emailAuth.bindToUserAgent')}</Label>
                                <p className="text-xs text-muted-foreground">Vincular al navegador (User Agent)</p>
                            </div>
                            <Switch
                                checked={config.magic_link?.bind_to_user_agent}
                                onCheckedChange={(val) => updateSubConfig('magic_link', 'bind_to_user_agent', val)}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'verification' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-200">
                        <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <Label>{t('emailAuth.active')}</Label>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                            {t('emailAuth.tooltips.verificationActive')}
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                                <p className="text-xs text-muted-foreground">Obliga a verificar el email antes de entrar</p>
                            </div>
                            <Switch
                                checked={config.verification?.enabled}
                                onCheckedChange={(val) => updateSubConfig('verification', 'enabled', val)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Label>{t('emailAuth.codeSize')}</Label>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                            {t('emailAuth.tooltips.codeSize')}
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                                <Input
                                    type="number"
                                    value={config.verification?.code_size || ''}
                                    onChange={(e) => updateSubConfig('verification', 'code_size', parseInt(e.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Label>{t('emailAuth.ttlSec')}</Label>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                            {t('emailAuth.tooltips.ttlSec')}
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                                <Input
                                    type="number"
                                    value={config.verification?.ttl_seconds || ''}
                                    onChange={(e) => updateSubConfig('verification', 'ttl_seconds', parseInt(e.target.value))}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Label>{t('emailAuth.codeType')}</Label>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                        {t('emailAuth.tooltips.codeType')}
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <Select
                                value={config.verification?.code_type || 'numeric'}
                                onValueChange={(val) => updateSubConfig('verification', 'code_type', val)}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="numeric">numeric</SelectItem>
                                    <SelectItem value="alphanumeric">alphanumeric</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Label>{t('emailAuth.codeStrategy')}</Label>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-sm">
                                        {t('emailAuth.tooltips.codeStrategy')}
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <Select
                                value={config.verification?.code_strategy ?? 'random'}
                                onValueChange={(val) => handleStrategyChange(val as 'random' | 'fixed')}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="random">{t('emailAuth.strategy.random')}</SelectItem>
                                    <SelectItem value="fixed">{t('emailAuth.strategy.fixed')}</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {t('emailAuth.strategy.helper')}
                            </p>
                        </div>

                        {config.verification?.code_strategy === 'fixed' && (
                            <div className="space-y-2 p-4 rounded-xl border border-amber-500/40 bg-amber-500/5">
                                <div className="flex items-center gap-2">
                                    <Label className="text-amber-700 dark:text-amber-400">
                                        {t('emailAuth.fixedCode')}
                                    </Label>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="w-3.5 h-3.5 text-amber-600 cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-sm">
                                            {t('emailAuth.tooltips.fixedCode')}
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                                <Input
                                    value={config.verification?.fixed_code ?? ''}
                                    onChange={(e) => updateSubConfig('verification', 'fixed_code', e.target.value)}
                                    placeholder="123456"
                                    className="font-mono"
                                />
                                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                    <span>{t('emailAuth.strategy.fixedWarning')}</span>
                                </p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>{t('emailAuth.mode')}</Label>
                            <Input
                                value={config.verification?.mode || ''}
                                readOnly
                                className="bg-muted/50 text-muted-foreground cursor-not-allowed"
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-4 border-t">
                <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
                    {t('common.cancel')}
                </Button>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button onClick={() => onSave(config)} disabled={isSubmitting}>
                            {isSubmitting ? t('behaviors.saving') : t('behaviors.saveChanges')}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        {t('tooltips.saveSettings')}
                    </TooltipContent>
                </Tooltip>
            </div>

            <Dialog open={pendingFixed} onOpenChange={(open) => { if (!open) setPendingFixed(false); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="w-5 h-5" />
                            {t('emailAuth.confirmFixed.title')}
                        </DialogTitle>
                        <DialogDescription asChild>
                            <div className="space-y-3 pt-2">
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
                            </div>
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
                        <Button variant="outline" onClick={() => setPendingFixed(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button
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
