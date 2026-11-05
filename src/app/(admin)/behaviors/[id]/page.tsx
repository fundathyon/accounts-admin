'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Settings, Pencil } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Heading,
  JsonViewer,
  Tooltip,
} from '@foundathyon/community-ui';
import { Button, buttonVariants } from '@/components/fdn/button';
import { Badge } from '@/components/fdn/badge';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { useEdition } from '@/context/edition-context';
import { apiError, type Envelope } from '@/lib/api-envelope';
import {
  BEHAVIOR_SCOPE_TO_I18N,
  behaviorScreen,
  genericUpdateRefused,
  withEmailCodeDefaults,
  withSessionsDefaults,
  type EmailAuthConfig,
} from '@/lib/behaviors';
import { buildAdminHref, cn } from '@/lib/utils';
import { EmailAuthConfigView } from '@/components/behaviors/email-auth-config-view';
import { EmailAuthConfigForm, type EmailAuthTab } from '@/components/behaviors/email-auth-config-form';
import { EmailLocaleCard } from '@/components/behaviors/email-locale-card';
import { JsonConfigForm } from '@/components/behaviors/json-config-form';
import { ScreenLoading, ScreenUnavailable } from '@/components/security-screen/screen-states';
import type { AppBehaviorDetail } from '@/lib/admin-types';

type EmailNode = 'verification' | 'magic_link' | 'email_code' | 'testers';

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export default function BehaviorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { apiUrl, showNotification, savedSecretKey } = useAdmin();
  const { t } = useI18n();
  const { isPro } = useEdition();
  const [behavior, setBehavior] = useState<AppBehaviorDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const id = params.id as string;
  const behaviorsHref = buildAdminHref('/behaviors');
  const [toggling, setToggling] = useState<EmailNode | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editorTab, setEditorTab] = useState<EmailAuthTab>('email');
  const [updating, setUpdating] = useState(false);

  const errorText = (json: Envelope | null, fallback: string) => {
    const error = apiError(json);
    const scopeKey = error?.scope ? BEHAVIOR_SCOPE_TO_I18N[error.scope] : undefined;
    return scopeKey ? t(scopeKey) : (error?.message ?? fallback);
  };

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
  }, [apiUrl, id, savedSecretKey, showNotification, t]);

  /** One-click switch of an `email_auth` node through its activation endpoint. */
  const toggleNode = async (node: EmailNode, endpoint: string, body: unknown, success: string) => {
    if (!savedSecretKey) return;
    setToggling(node);
    try {
      const res = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: {
          'X-Secret-API-Key': savedSecretKey,
          ...(body !== undefined && { 'Content-Type': 'application/json' }),
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
      });
      const json = (await res.json().catch(() => null)) as Envelope | null;
      if (res.ok) {
        showNotification(success, 'success');
        await loadBehavior();
      } else {
        showNotification(errorText(json, t('behaviors.errorUpdate')), 'error');
      }
    } catch {
      showNotification(t('behaviors.errorServer'), 'error');
    } finally {
      setToggling(null);
    }
  };

  const emailConfig = (behavior?.config ?? {}) as EmailAuthConfig;

  const toggleEmailVerification = () => {
    const enabled = emailConfig.verification?.enabled ?? false;
    return enabled
      ? toggleNode('verification', '/api/behaviors/email/verification/deactivate', undefined, t('behaviors.verificationDeactivated'))
      : toggleNode('verification', '/api/behaviors/email/verification/activate', {}, t('behaviors.verificationActivated'));
  };

  // The backend has no deactivate route for these three: the activation takes `enabled`.
  const toggleMagicLink = () => {
    const enabled = !(emailConfig.magic_link?.enabled ?? false);
    return toggleNode(
      'magic_link',
      '/api/behaviors/email/magic-link/activate',
      { enabled },
      enabled ? t('behaviors.magicLinkActivated') : t('behaviors.magicLinkDeactivated'),
    );
  };

  const toggleEmailCode = () => {
    const enabled = !(emailConfig.email_code?.enabled ?? false);
    return toggleNode(
      'email_code',
      '/api/behaviors/email/email-code/activate',
      { enabled },
      enabled ? t('behaviors.emailCodeActivated') : t('behaviors.emailCodeDeactivated'),
    );
  };

  const toggleTesters = () => {
    const enabled = !(emailConfig.testers?.enabled ?? false);
    return toggleNode(
      'testers',
      '/api/behaviors/email/testers/activate',
      { enabled },
      enabled ? t('behaviors.testersActivated') : t('behaviors.testersDeactivated'),
    );
  };

  /** POST or PUT with a JSON body; returns the error text, or null if it worked. */
  const send = async (path: string, method: 'POST' | 'PUT', body: unknown): Promise<string | null> => {
    const res = await fetch(apiUrl(path), {
      method,
      headers: { 'X-Secret-API-Key': savedSecretKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return null;
    const json = (await res.json().catch(() => null)) as Envelope | null;
    return errorText(json, t('behaviors.updateError'));
  };

  /**
   * The generic PUT does not validate the nodes, so whatever has a validating
   * endpoint that can express it goes there first: email_code, sessions (not in
   * Pro, where they are edited in `tokens`) and verification while enabled (its
   * activation always leaves it on). The PUT, which merges, carries the rest.
   */
  const handleSaveConfig = async (next: EmailAuthConfig) => {
    if (!savedSecretKey) return;
    const current = (behavior?.config ?? {}) as EmailAuthConfig;
    const { email_code: emailCode, sessions, ...rest } = next;
    delete rest.testers;
    setUpdating(true);
    try {
      let failure: string | null = null;
      if (!sameJson(withEmailCodeDefaults(current.email_code), emailCode)) {
        failure = await send('/api/behaviors/email/email-code/activate', 'POST', emailCode);
      }
      if (!failure && !isPro && !sameJson(withSessionsDefaults(current.sessions), sessions)) {
        failure = await send('/api/behaviors/email/sessions/activate', 'POST', sessions);
      }
      if (!failure && next.verification?.enabled && !sameJson(current.verification, next.verification)) {
        const verification = { ...next.verification };
        delete verification.enabled;
        failure = await send('/api/behaviors/email/verification/activate', 'POST', verification);
      }
      if (!failure) failure = await send(`/api/behaviors/${id}`, 'PUT', { config: rest });

      if (failure) {
        showNotification(failure, 'error');
      } else {
        showNotification(t('behaviors.updateSuccess'), 'success');
        setIsEditing(false);
      }
      await loadBehavior();
    } catch {
      showNotification(t('behaviors.updateError'), 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveJson = async (config: Record<string, unknown>) => {
    setUpdating(true);
    try {
      const failure = await send(`/api/behaviors/${id}`, 'PUT', { config });
      if (failure) {
        showNotification(failure, 'error');
        return;
      }
      showNotification(t('behaviors.updateSuccess'), 'success');
      setIsEditing(false);
      await loadBehavior();
    } catch {
      showNotification(t('behaviors.updateError'), 'error');
    } finally {
      setUpdating(false);
    }
  };

  const openEditor = (tab: EmailAuthTab = 'email') => {
    setEditorTab(tab);
    setIsEditing(true);
  };

  useEffect(() => {
    if (!savedSecretKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadBehavior();
  }, [id, savedSecretKey, loadBehavior]);

  // Pro: `tokens` is edited on its own page; in Community that page has nothing to show.
  const code = behavior?.behavior_code ?? '';
  useEffect(() => {
    if (isPro && code === 'tokens') router.replace('/behaviors/tokens');
  }, [code, isPro, router]);

  if (loading) return <ScreenLoading />;

  if (!savedSecretKey) {
    return <ScreenUnavailable title={t('behaviors.secretKeyRequired')} body={t('behaviors.secretKeyRequiredDesc')} />;
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
          <p className="text-text-muted">{t('behaviors.behaviorNotFound')}</p>
        </Card>
      </div>
    );
  }

  const isEmailAuth = code === 'email_auth';
  const isEmailLocale = code === 'email_locale';
  const screen = behaviorScreen(code, isPro);
  const editable = !isEmailLocale && !genericUpdateRefused(code, isPro);

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
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <Heading level={1} visual="h2">{behavior.behavior_code}</Heading>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="tonal" tone={behavior.is_active ? 'success' : 'neutral'}>
                {behavior.is_active ? t('common.active') : t('behaviors.inactive')}
              </Badge>
              <span className="text-xs text-text-muted font-mono truncate">{behavior.id}</span>
            </div>
          </div>
          {editable && (
            <Tooltip content={t('behaviors.editBehavior')}>
              <Button variant="secondary" className="gap-2 shrink-0" onClick={() => openEditor()}>
                <Pencil className="w-4 h-4" />
                {t('common.edit')}
              </Button>
            </Tooltip>
          )}
        </div>

        <div>
          <h3 className="text-body font-bold uppercase tracking-widest text-text-muted mb-4 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            {isEmailAuth ? t('behaviors.config') : t('behaviors.configJson')}
          </h3>
          {isEmailAuth ? (
            <div className="space-y-6">
              <EmailAuthConfigView
                config={emailConfig}
                isPro={isPro}
                onToggleVerification={toggleEmailVerification}
                togglingVerification={toggling === 'verification'}
                onToggleMagicLink={toggleMagicLink}
                togglingMagicLink={toggling === 'magic_link'}
                onToggleEmailCode={toggleEmailCode}
                togglingEmailCode={toggling === 'email_code'}
                onToggleTesters={toggleTesters}
                togglingTesters={toggling === 'testers'}
                onEditSessions={() => openEditor('sessions')}
                onActivateMetadataSchema={() => openEditor('metadata')}
              />
              <EmailLocaleCard secretKey={savedSecretKey} />
            </div>
          ) : isEmailLocale ? (
            <EmailLocaleCard secretKey={savedSecretKey} />
          ) : (
            <JsonViewer
              data={behavior.config}
              defaultExpandDepth={2}
              expandable
              copyValue
              copyPath
            />
          )}
          {screen && (
            <Link
              href={buildAdminHref(screen)}
              className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'mt-4')}
            >
              {t('behaviors.openScreen')}
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <div className="text-xs text-text-muted font-medium uppercase">{t('behaviors.createdBy')}</div>
            <div className="text-body font-mono">{behavior.created_by}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-text-muted font-medium uppercase">{t('oauth.appId')}</div>
            <div className="text-body font-mono">{behavior.app_id}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-text-muted font-medium uppercase">{t('behaviors.dateCreated')}</div>
            <div className="text-body">{new Date(behavior.created_at).toLocaleString()}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-text-muted font-medium uppercase">{t('behaviors.lastUpdate')}</div>
            <div className="text-body">{new Date(behavior.updated_at).toLocaleString()}</div>
          </div>
        </div>
      </div>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent
          className="w-[min(95vw,1000px)] sm:max-w-[min(95vw,1000px)] max-h-[90vh] overflow-hidden flex flex-col p-6"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-text-muted" />
              {t('behaviors.editBehavior')}
            </DialogTitle>
            <DialogDescription>
              {t('behaviors.editDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden mt-4">
            {isEmailAuth ? (
              <EmailAuthConfigForm
                initialConfig={emailConfig}
                sessionsEditable={!isPro}
                initialTab={editorTab}
                onCancel={() => setIsEditing(false)}
                onSave={handleSaveConfig}
                isSubmitting={updating}
              />
            ) : (
              <JsonConfigForm
                initialConfig={behavior.config}
                onCancel={() => setIsEditing(false)}
                onSave={handleSaveJson}
                isSubmitting={updating}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
