'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';

const STORAGE_SECRET = 'authify_secret_key';

/** v3: si !pending_migration no debe bloquear toasts futuros cuando vuelva a haber pendiente (v2 guardaba siempre y rompía). */
const SESSION_KEY = 'oauth_legacy_migration_prompted_v3';

function markPrompted() {
  if (typeof window !== 'undefined') sessionStorage.setItem(SESSION_KEY, '1');
}

function clearPrompted() {
  if (typeof window !== 'undefined') sessionStorage.removeItem(SESSION_KEY);
}

function resolveSecretKey(saved: string): string {
  const trimmed = saved.trim();
  if (trimmed) return trimmed;
  if (typeof window === 'undefined') return '';
  return (localStorage.getItem(STORAGE_SECRET) || '').trim();
}

export function OAuthLegacyMigrationNotifier() {
  const { savedSecretKey, apiUrl, showNotification, setPendingOAuthLegacyMigration } = useAdmin();
  const { t } = useI18n();
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const secretKey = resolveSecretKey(savedSecretKey);
    if (!secretKey) {
      setPendingOAuthLegacyMigration(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl('/api/oauth-configs/migration/legacy-redirects-status'), {
          credentials: 'include',
          headers: { 'X-Secret-API-Key': secretKey },
        });

        const raw = await res.text();
        let data: {
          success?: boolean;
          data?: { pending_migration?: boolean; pending?: { provider?: string; name?: string }[] };
        };
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          if (!cancelled) setPendingOAuthLegacyMigration(false);
          return;
        }

        if (cancelled) return;

        if (!res.ok) {
          if (!cancelled) setPendingOAuthLegacyMigration(false);
          return;
        }

        const needsMigration = !!(data.success && data.data?.pending_migration);
        if (!cancelled) setPendingOAuthLegacyMigration(needsMigration);

        if (!needsMigration) {
          // Sin pendiente: quitar la marca para que, si luego hay migración (p. ej. datos nuevos), el toast pueda salir.
          clearPrompted();
          return;
        }

        // Solo suprimir repetición si el usuario ya vio el toast o lo pospuso en esta sesión.
        if (sessionStorage.getItem(SESSION_KEY)) return;

        const pending = data.data?.pending;
        const providers = (pending ?? [])
          .map((p) => (p.name ? `${p.provider} (${p.name})` : p.provider))
          .filter(Boolean)
          .join(', ');

        const toastId = toast.warning(t('oauth.migrationPendingTitle'), {
          description: t('oauth.migrationPendingDescription', { providers: providers || '—' }),
          duration: 20_000,
          className:
            '!max-w-[min(100vw-2rem,40rem)] !min-w-[min(100vw-2rem,20rem)] sm:!min-w-[32rem] !items-start',
          onDismiss: markPrompted,
          action: {
            label: t('oauth.migrationApplyNow'),
            onClick: async () => {
              try {
                const applyRes = await fetch(apiUrl('/api/oauth-configs/migration/legacy-redirects-apply'), {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'X-Secret-API-Key': secretKey },
                });
                const applyRaw = await applyRes.text();
                let applyData: { success?: boolean; error?: { message?: string } };
                try {
                  applyData = applyRaw ? JSON.parse(applyRaw) : {};
                } catch {
                  showNotification(t('oauth.errorConnection'), 'error');
                  return;
                }
                if (applyData.success) {
                  markPrompted();
                  setPendingOAuthLegacyMigration(false);
                  toast.dismiss(toastId);
                  showNotification(t('oauth.migrationSuccess'), 'success');
                } else {
                  showNotification(applyData.error?.message || t('oauth.migrationError'), 'error');
                }
              } catch {
                showNotification(t('oauth.errorConnection'), 'error');
              }
            },
          },
          cancel: {
            label: t('oauth.migrationLater'),
            onClick: markPrompted,
          },
        });
      } catch {
        if (!cancelled) setPendingOAuthLegacyMigration(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [savedSecretKey, apiUrl, showNotification, t, setPendingOAuthLegacyMigration]);

  return null;
}
