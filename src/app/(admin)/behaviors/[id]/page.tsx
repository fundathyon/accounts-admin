'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Puzzle, Settings, Pencil } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Badge,
  Button,
  buttonVariants,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Spinner,
  Tooltip,
} from '@foundathyon/community-ui';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { BASE_PATH } from '@/lib/utils';
import { EmailAuthConfigView, type EmailAuthConfig } from '@/components/behaviors/email-auth-config-view';
import { EmailAuthConfigForm } from '@/components/behaviors/email-auth-config-form';
import { cn } from '@/lib/utils';
import type { AppBehaviorDetail } from '@/lib/admin-types';

const SCOPE_TO_I18N: Record<string, string> = {
  'app_behaviors.activate_verification.code_strategy_fixed_not_allowed_in_environment':
    'emailAuth.errors.fixedNotAllowedHere',
  'app_behaviors.activate_verification.fixed_code_required':
    'emailAuth.errors.fixedCodeRequired',
  'app_behaviors.activate_verification.fixed_code_length_mismatch':
    'emailAuth.errors.fixedCodeLengthMismatch',
  'app_behaviors.activate_verification.fixed_code_character_class_mismatch':
    'emailAuth.errors.fixedCodeCharClassMismatch',
};

export default function BehaviorDetailPage() {
  const params = useParams();
  const { apiUrl, showNotification, savedSecretKey } = useAdmin();
  const { t } = useI18n();
  const [behavior, setBehavior] = useState<AppBehaviorDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const id = params.id as string;
  const behaviorsHref = `${BASE_PATH}/behaviors`.replace(/\/+/g, '/') || '/behaviors';
  const [toggling, setToggling] = useState(false);
  const [togglingMagicLink, setTogglingMagicLink] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [updating, setUpdating] = useState(false);

  const loadBehavior = useCallback(async () => {
    if (!savedSecretKey) return;
    try {
      const res = await fetch(apiUrl(`/api/behaviors/${id}`), {
        headers: { 'X-Secret-API-Key': savedSecretKey },
      });
      const data = await res.json();
      if (data.success) setBehavior(data.data);
      else showNotification(data.error?.message || t('behaviors.errorLoadDetails'), 'error');
    } catch {
      showNotification(t('behaviors.errorLoadDetails'), 'error');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, id, savedSecretKey, showNotification]);

  const toggleEmailVerification = async () => {
    if (!savedSecretKey || behavior?.behavior_code !== 'email_auth') return;
    const emailConfig = behavior.config as { verification?: { enabled?: boolean } };
    const isEnabled = emailConfig?.verification?.enabled ?? false;
    const endpoint = isEnabled ? '/api/behaviors/email/verification/deactivate' : '/api/behaviors/email/verification/activate';
    setToggling(true);
    try {
      const res = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: {
          'X-Secret-API-Key': savedSecretKey,
          ...(!isEnabled && { 'Content-Type': 'application/json' }),
        },
        ...(!isEnabled && { body: JSON.stringify({}) }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(isEnabled ? t('behaviors.verificationDeactivated') : t('behaviors.verificationActivated'), 'success');
        await loadBehavior();
      } else {
        showNotification(data.error?.message || t('behaviors.errorUpdate'), 'error');
      }
    } catch {
      showNotification(t('behaviors.errorServer'), 'error');
    } finally {
      setToggling(false);
    }
  };

  const toggleMagicLink = async () => {
    if (!savedSecretKey || behavior?.behavior_code !== 'email_auth') return;
    const emailConfig = behavior.config as { magic_link?: { enabled?: boolean } };
    const isEnabled = emailConfig?.magic_link?.enabled ?? false;
    const endpoint = isEnabled ? '/api/behaviors/email/magic-link/deactivate' : '/api/behaviors/email/magic-link/activate';
    setTogglingMagicLink(true);
    try {
      const res = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: {
          'X-Secret-API-Key': savedSecretKey,
          ...(!isEnabled && { 'Content-Type': 'application/json' }),
        },
        ...(!isEnabled && { body: JSON.stringify({}) }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(isEnabled ? t('behaviors.magicLinkDeactivated') : t('behaviors.magicLinkActivated'), 'success');
        await loadBehavior();
      } else {
        showNotification(data.error?.message || t('behaviors.errorUpdate'), 'error');
      }
    } catch {
      showNotification(t('behaviors.errorServer'), 'error');
    } finally {
      setTogglingMagicLink(false);
    }
  };

  const handleSaveConfig = async (newConfig: any) => {
    if (!savedSecretKey) return;
    setUpdating(true);
    try {
      const res = await fetch(apiUrl(`/api/behaviors/${id}`), {
        method: 'PUT',
        headers: {
          'X-Secret-API-Key': savedSecretKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config: newConfig }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(t('behaviors.updateSuccess'), 'success');
        setIsEditing(false);
        await loadBehavior();
      } else {
        const scope: string | undefined = data?.error?.scope;
        const scopeKey = scope && SCOPE_TO_I18N[scope];
        const message = scopeKey ? t(scopeKey) : (data.error?.message || t('behaviors.updateError'));
        showNotification(message, 'error');
      }
    } catch {
      showNotification(t('behaviors.updateError'), 'error');
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    if (!savedSecretKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadBehavior();
  }, [id, savedSecretKey, loadBehavior]);

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <Spinner size={20} label={t('common.loading')} className="text-accent" />
      </div>
    );
  }

  if (!behavior) {
    return (
      <div className="space-y-6">
        <Link
          href={behaviorsHref}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'mb-6 gap-2 -ml-2')}
        >
          <ChevronLeft className="w-4 h-4" /> {t('behaviors.backToBehaviors')}
        </Link>
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">{t('behaviors.behaviorNotFound')}</p>
        </Card>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Tooltip content={t('behaviors.backToBehaviors')} side="right">
        <Link
          href={behaviorsHref}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'mb-6 gap-2 -ml-2')}
        >
          <ChevronLeft className="w-4 h-4" /> {t('behaviors.backToBehaviors')}
        </Link>
      </Tooltip>

      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400">
              <Puzzle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{behavior.behavior_code}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant="tonal"
                  tone={behavior.is_active ? 'success' : 'neutral'}
                >
                  {behavior.is_active ? t('common.active') : t('behaviors.inactive')}
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">{behavior.id}</span>
              </div>
            </div>
          </div>
          <Tooltip content={t('behaviors.editBehavior')}>
            <Button variant="secondary" className="gap-2" onClick={() => setIsEditing(true)}>
              <Pencil className="w-4 h-4" />
              {t('common.edit')}
            </Button>
          </Tooltip>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            {behavior.behavior_code === 'email_auth' ? t('behaviors.config') : t('behaviors.configJson')}
          </h3>
          {behavior.behavior_code === 'email_auth' ? (
            <EmailAuthConfigView
              config={behavior.config as EmailAuthConfig}
              onToggleVerification={toggleEmailVerification}
              togglingVerification={toggling}
              onToggleMagicLink={toggleMagicLink}
              togglingMagicLink={togglingMagicLink}
            />
          ) : (
            <div className="bg-muted/50 rounded-2xl p-4 border font-mono text-sm overflow-x-auto">
              <pre className="text-sky-300">{JSON.stringify(behavior.config, null, 2)}</pre>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground font-medium uppercase">{t('behaviors.createdBy')}</div>
            <div className="text-sm font-mono">{behavior.created_by}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground font-medium uppercase">{t('oauth.appId')}</div>
            <div className="text-sm font-mono">{behavior.app_id}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground font-medium uppercase">{t('behaviors.dateCreated')}</div>
            <div className="text-sm">{new Date(behavior.created_at).toLocaleString()}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground font-medium uppercase">{t('behaviors.lastUpdate')}</div>
            <div className="text-sm">{new Date(behavior.updated_at).toLocaleString()}</div>
          </div>
        </div>
      </div>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent
          size="lg"
          className="w-[min(95vw,1000px)] sm:max-w-[min(95vw,1000px)] max-h-[90vh] overflow-hidden flex flex-col p-6"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-accent" />
              {t('behaviors.editBehavior')}
            </DialogTitle>
            <DialogDescription>
              {t('behaviors.editDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden mt-4">
            {behavior.behavior_code === 'email_auth' ? (
              <EmailAuthConfigForm
                initialConfig={behavior.config as EmailAuthConfig}
                onCancel={() => setIsEditing(false)}
                onSave={handleSaveConfig}
                isSubmitting={updating}
              />
            ) : (
              <div className="space-y-4 h-full flex flex-col">
                <div className="flex-1 bg-muted/50 rounded-xl border p-4 font-mono text-sm overflow-auto">
                  <pre className="text-sky-300">
                    {JSON.stringify(behavior.config, null, 2)}
                  </pre>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="secondary" onClick={() => setIsEditing(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button variant="primary" disabled>
                    (Sólo email_auth es editable por ahora)
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
