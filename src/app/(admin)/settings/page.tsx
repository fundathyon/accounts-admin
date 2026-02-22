'use client';

import { useState, useEffect } from 'react';
import {
  Key,
  Users,
  Server,
  RefreshCw,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { apiUrl } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { EnvVar } from '@/lib/admin-types';

export default function SettingsPage() {
  const { t } = useI18n();
  const {
    savedSecretKey,
    savedPublishableKey,
    setSavedSecretKey,
    setSavedPublishableKey,
    showNotification,
  } = useAdmin();

  const [secretApiKey, setSecretApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [publishableApiKey, setPublishableApiKey] = useState('');
  const [showPublishableKey, setShowPublishableKey] = useState(false);

  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [envLoading, setEnvLoading] = useState(false);
  const [envError, setEnvError] = useState('');
  const [showSensitiveValues, setShowSensitiveValues] = useState<Record<string, boolean>>({});
  const [hasRevealedEnvVars, setHasRevealedEnvVars] = useState(false);

  useEffect(() => {
    setSecretApiKey(savedSecretKey);
    setPublishableApiKey(savedPublishableKey);
  }, [savedSecretKey, savedPublishableKey]);

  const handleSaveKey = () => {
    if (!secretApiKey.trim()) {
      showNotification(t('settings.secretKeyRequired'), 'error');
      return;
    }
    setSavedSecretKey(secretApiKey.trim());
    showNotification(t('settings.secretKeySaved'), 'success');
  };

  const handleClearKey = () => {
    setSavedSecretKey('');
    setSecretApiKey('');
    showNotification(t('settings.secretKeyCleared'), 'success');
  };

  const handleSavePublishableKey = () => {
    if (!publishableApiKey.trim()) {
      showNotification(t('settings.publishableRequired'), 'error');
      return;
    }
    setSavedPublishableKey(publishableApiKey.trim());
    showNotification(t('settings.publishableSaved'), 'success');
  };

  const handleClearPublishableKey = () => {
    setSavedPublishableKey('');
    setPublishableApiKey('');
    showNotification(t('settings.publishableCleared'), 'success');
  };

  const fetchEnvVars = async (revealSensitive = false) => {
    setEnvLoading(true);
    setEnvError('');
    try {
      const url = revealSensitive ? apiUrl('/api/system/env?reveal_sensitive=1') : apiUrl('/api/system/env');
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.data) {
        setEnvVars(data.data);
        if (revealSensitive) setHasRevealedEnvVars(true);
        else {
          setHasRevealedEnvVars(false);
          setShowSensitiveValues({});
        }
        if (!revealSensitive) showNotification(`${data.data.length} ${t('settings.varsLoaded')}`, 'success');
      } else {
        setEnvError(data.error?.message || t('settings.errorLoadEnv'));
      }
    } catch {
      setEnvError(t('settings.errorConnectionServer'));
    } finally {
      setEnvLoading(false);
    }
  };

  const handleToggleSensitive = async (key: string) => {
    const willShow = !showSensitiveValues[key];
    if (willShow && !hasRevealedEnvVars) {
      setEnvLoading(true);
      setEnvError('');
      try {
        const res = await fetch(apiUrl('/api/system/env?reveal_sensitive=1'));
        const data = await res.json();
        if (data.success && data.data) {
          setEnvVars(data.data);
          setHasRevealedEnvVars(true);
          setShowSensitiveValues((prev) => ({ ...prev, [key]: true }));
        } else {
          showNotification(data.error?.message || t('settings.errorLoadValues'), 'error');
        }
      } catch {
        showNotification(t('common.errorConnection'), 'error');
      } finally {
        setEnvLoading(false);
      }
    } else {
      setShowSensitiveValues((prev) => ({ ...prev, [key]: willShow }));
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-3xl font-bold mb-8">{t('settings.title')}</h1>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        <Card className="p-8 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{t('settings.secretKey')}</CardTitle>
              <CardDescription>{t('settings.secretKeyDesc')}</CardDescription>
            </div>
          </div>
          <div className="flex flex-col flex-1 space-y-4">
            <div className="space-y-2">
              <Label>{t('settings.secretKey')}</Label>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  placeholder={t('settings.secretKeyPlaceholder')}
                  value={secretApiKey}
                  onChange={(e) => setSecretApiKey(e.target.value)}
                  className="pr-12 font-mono"
                />
                <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setShowKey((v) => !v)}>
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="flex gap-3 mt-auto pt-4">
              <Button onClick={handleSaveKey} className="flex-1 gap-2">
                <Key className="w-4 h-4" /> {t('settings.saveKey')}
              </Button>
              {savedSecretKey && (
                <Button variant="outline" onClick={handleClearKey} className="border-destructive/30 text-destructive hover:bg-destructive/10">
                  {t('common.delete')}
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-8 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{t('settings.publishableKey')}</CardTitle>
              <CardDescription>{t('settings.publishableKeyDesc')}</CardDescription>
            </div>
          </div>
          <div className="flex flex-col flex-1 space-y-4">
            <div className="space-y-2">
              <Label>{t('settings.publishableKey')}</Label>
              <div className="relative">
                <Input
                  type={showPublishableKey ? 'text' : 'password'}
                  placeholder={t('settings.publishableKeyPlaceholder')}
                  value={publishableApiKey}
                  onChange={(e) => setPublishableApiKey(e.target.value)}
                  className="pr-12 font-mono"
                />
                <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setShowPublishableKey((v) => !v)}>
                  {showPublishableKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground px-1">
                {t('settings.getPublishableHint')}
              </p>
            </div>
            <div className="flex gap-3 mt-auto pt-4">
              <Button onClick={handleSavePublishableKey} className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-500">
                <Users className="w-4 h-4" /> {t('settings.savePublishableKey')}
              </Button>
              {savedPublishableKey && (
                <Button variant="outline" onClick={handleClearPublishableKey} className="border-destructive/30 text-destructive hover:bg-destructive/10">
                  {t('common.delete')}
                </Button>
              )}
            </div>
          </div>
        </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between p-6 border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-400">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">{t('settings.envVars')}</CardTitle>
                <CardDescription>{t('settings.envVarsDesc')}</CardDescription>
              </div>
            </div>
            <Button onClick={() => fetchEnvVars()} disabled={envLoading} className="gap-2 bg-sky-600 hover:bg-sky-500">
              {envLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {envLoading ? t('common.loading') : t('settings.loadVars')}
            </Button>
          </CardHeader>

          {envError && (
            <div className="mx-6 mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <div>
                <span className="font-semibold">{t('common.error')}: </span>
                {envError}
                {envError.includes('disabled') && (
                  <span className="block mt-1 text-muted-foreground text-xs">
                    {t('settings.exposeEnvHint')}
                  </span>
                )}
              </div>
            </div>
          )}

          {envVars.length === 0 && !envError && (
            <div className="p-10 text-center text-muted-foreground text-sm">
              <Server className="w-8 h-8 mx-auto mb-3 opacity-30" />
              {t('settings.envEmptyHint')}
            </div>
          )}

          {envVars.length > 0 && (
            <div className="divide-y divide-border">
              {Array.from(new Set(envVars.map((e) => e.category))).map((category) => (
                <div key={category}>
                  <div className="px-6 py-2 bg-muted/30">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{category}</span>
                  </div>
                  {envVars
                    .filter((e) => e.category === category)
                    .map((envVar) => (
                      <div key={envVar.key} className="px-6 py-3 hover:bg-muted/50 transition-colors flex items-center gap-4">
                        <div className="w-64 shrink-0">
                          <span
                            className={cn(
                              'text-xs font-mono font-semibold',
                              envVar.sensitive ? 'text-amber-400' : 'text-sky-400'
                            )}
                          >
                            {envVar.key}
                          </span>
                          {envVar.sensitive && (
                            <span className="ml-2 px-1.5 py-0.5 bg-amber-500/10 text-amber-500 rounded text-[10px] font-semibold">
                              {t('settings.sensitive')}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {envVar.sensitive ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono text-muted-foreground truncate">
                                {showSensitiveValues[envVar.key] ? envVar.value : '••••••••'}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                                onClick={() => handleToggleSensitive(envVar.key)}
                                disabled={envLoading}
                              >
                                {showSensitiveValues[envVar.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </Button>
                            </div>
                          ) : (
                            <span
                              className={cn(
                                'text-sm font-mono truncate block',
                                envVar.value === 'false'
                                  ? 'text-muted-foreground'
                                  : envVar.value === 'true'
                                    ? 'text-emerald-400'
                                    : envVar.value === ''
                                      ? 'text-muted-foreground italic'
                                      : 'text-foreground'
                              )}
                            >
                              {envVar.value === '' ? t('settings.empty') : envVar.value}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <CardTitle className="text-base mb-3">{t('settings.securityNotes')}</CardTitle>
          <ul className="space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
            <li>{t('settings.securityNote1')}</li>
            <li>{t('settings.securityNote2')}</li>
            <li>{t('settings.securityNote3')}</li>
            <li>{t('settings.securityNote4')}</li>
          </ul>
        </Card>
      </div>
    </motion.div>
  );
}
