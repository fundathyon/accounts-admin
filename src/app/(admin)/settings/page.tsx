'use client';

import { useState, useEffect } from 'react';
import {
  Key,
  Users,
  Server,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  FormField,
  Heading,
  Icon,
  Inline,
  Input,
  Spinner,
  Text,
  Tooltip,
} from '@foundathyon/community-ui';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { apiUrl } from '@/lib/utils';
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
    // We don't auto-populate the secretApiKey state with the saved value for security
    // setSecretApiKey(savedSecretKey);
    setPublishableApiKey(savedPublishableKey);
  }, [savedPublishableKey]); // Also removed savedSecretKey from deps to avoid unnecessary cycles

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
      <Heading level={1} className="mb-8">{t('settings.title')}</Heading>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          <Card className="p-8">
            <Inline gap={3} className="mb-6">
              <div className="w-10 h-10 rounded-2xl bg-accent-bg flex items-center justify-center text-accent">
                <Icon icon={Key} size={20} />
              </div>
              <div>
                <Heading level={2} visual="h3">{t('settings.secretKey')}</Heading>
                <Text tone="secondary">{t('settings.secretKeyDesc')}</Text>
              </div>
            </Inline>
            <div className="flex flex-col flex-1 space-y-4">
              <FormField label={t('settings.secretKey')}>
                <Input
                  type="password"
                  placeholder={savedSecretKey ? t('settings.secretKeySetPlaceholder') : t('settings.secretKeyPlaceholder')}
                  value={secretApiKey}
                  onChange={(e) => setSecretApiKey(e.target.value)}
                  className="font-mono"
                />
              </FormField>
              <Inline gap={3} className="mt-auto pt-4">
                <Tooltip content={t('tooltips.saveSettings')}>
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleSaveKey}
                    className="flex-1"
                    leading={<Icon icon={Key} size={16} />}
                  >
                    {t('settings.saveKey')}
                  </Button>
                </Tooltip>

                {savedSecretKey && (
                  <Tooltip content={t('tooltips.clearKey')}>
                    <Button variant="destructive-subtle" size="lg" onClick={handleClearKey}>
                      {t('common.delete')}
                    </Button>
                  </Tooltip>
                )}
              </Inline>
            </div>
          </Card>

          <Card className="p-8">
            <Inline gap={3} className="mb-6">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Icon icon={Users} size={20} />
              </div>
              <div>
                <Heading level={2} visual="h3">{t('settings.publishableKey')}</Heading>
                <Text tone="secondary">{t('settings.publishableKeyDesc')}</Text>
              </div>
            </Inline>
            <div className="flex flex-col flex-1 space-y-4">
              <FormField
                label={t('settings.publishableKey')}
                description={t('settings.getPublishableHint')}
              >
                <Input
                  type={showPublishableKey ? 'text' : 'password'}
                  placeholder={t('settings.publishableKeyPlaceholder')}
                  value={publishableApiKey}
                  onChange={(e) => setPublishableApiKey(e.target.value)}
                  className="font-mono"
                  trailing={
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="w-6 px-0"
                      onClick={() => setShowPublishableKey((v) => !v)}
                    >
                      <Icon icon={showPublishableKey ? EyeOff : Eye} size={14} />
                    </Button>
                  }
                />
              </FormField>
              <Inline gap={3} className="mt-auto pt-4">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleSavePublishableKey}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                  leading={<Icon icon={Users} size={16} />}
                >
                  {t('settings.savePublishableKey')}
                </Button>
                {savedPublishableKey && (
                  <Button variant="destructive-subtle" size="lg" onClick={handleClearPublishableKey}>
                    {t('common.delete')}
                  </Button>
                )}
              </Inline>
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader
            className="items-center border-b border-border p-6"
            actions={
              <Button
                variant="primary"
                size="lg"
                onClick={() => fetchEnvVars()}
                disabled={envLoading}
                className="bg-sky-600 hover:bg-sky-500 text-white"
                leading={envLoading ? <Spinner size={16} label={null} /> : <Icon icon={RefreshCw} size={16} />}
              >
                {envLoading ? t('common.loading') : t('settings.loadVars')}
              </Button>
            }
          >
            <Inline gap={3}>
              <div className="w-10 h-10 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-400">
                <Icon icon={Server} size={20} />
              </div>
              <div>
                <Heading level={2} visual="h3">{t('settings.envVars')}</Heading>
                <Text tone="secondary">{t('settings.envVarsDesc')}</Text>
              </div>
            </Inline>
          </CardHeader>

          {envError && (
            <Alert tone="danger" title={t('common.error')} className="mx-6 mt-4">
              {envError}
              {envError.includes('disabled') && (
                <span className="block mt-1 text-text-muted">
                  {t('settings.exposeEnvHint')}
                </span>
              )}
            </Alert>
          )}

          {envVars.length === 0 && !envError && (
            <div className="p-10 text-center">
              <Icon icon={Server} size={20} className="mx-auto mb-3 block opacity-30" />
              <Text tone="muted">{t('settings.envEmptyHint')}</Text>
            </div>
          )}

          {envVars.length > 0 && (
            <div className="divide-y divide-border">
              {Array.from(new Set(envVars.map((e) => e.category))).map((category) => (
                <div key={category}>
                  <div className="px-6 py-2 bg-muted/30">
                    <Text variant="overline" tone="muted" className="font-bold tracking-widest">{category}</Text>
                  </div>
                  {envVars
                    .filter((e) => e.category === category)
                    .map((envVar) => (
                      <div key={envVar.key} className="px-6 py-3 hover:bg-muted/50 transition-colors flex items-center gap-4">
                        <div className="w-64 shrink-0">
                          <Text
                            variant="code"
                            className={cn(
                              'font-semibold',
                              envVar.sensitive ? 'text-amber-400' : 'text-sky-400'
                            )}
                          >
                            {envVar.key}
                          </Text>
                          {envVar.sensitive && (
                            <Badge tone="warning" className="ml-2">
                              {t('settings.sensitive')}
                            </Badge>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {envVar.sensitive ? (
                            <Inline gap={2}>
                              <Text variant="code" tone="muted" className="truncate">
                                {showSensitiveValues[envVar.key] ? envVar.value : '••••••••'}
                              </Text>
                              <Button
                                variant="ghost"
                                size="xs"
                                className="w-6 shrink-0 px-0"
                                onClick={() => handleToggleSensitive(envVar.key)}
                                disabled={envLoading}
                              >
                                <Icon icon={showSensitiveValues[envVar.key] ? EyeOff : Eye} size={12} />
                              </Button>
                            </Inline>
                          ) : (
                            <Text
                              variant="code"
                              as="span"
                              className={cn(
                                'truncate block',
                                envVar.value === 'false'
                                  ? 'text-text-muted'
                                  : envVar.value === 'true'
                                    ? 'text-emerald-400'
                                    : envVar.value === ''
                                      ? 'text-text-muted italic'
                                      : 'text-text'
                              )}
                            >
                              {envVar.value === '' ? t('settings.empty') : envVar.value}
                            </Text>
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
          <Heading level={2} visual="h4" className="mb-3">{t('settings.securityNotes')}</Heading>
          <ul className="space-y-1.5 text-sm text-text-muted list-disc list-inside">
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
