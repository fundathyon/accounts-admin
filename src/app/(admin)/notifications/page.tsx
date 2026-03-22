'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Bell, CheckCircle2, Loader2 } from 'lucide-react';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { buildAdminHref, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type PendingOAuthItem = {
  oauth_config_id: string;
  provider: string;
  name?: string;
};

export default function NotificationsPage() {
  const { t } = useI18n();
  const { savedSecretKey, apiUrl, showNotification, setPendingOAuthLegacyMigration } = useAdmin();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [migrationPending, setMigrationPending] = useState(false);
  const [migrationItems, setMigrationItems] = useState<PendingOAuthItem[]>([]);
  const [applyLoading, setApplyLoading] = useState(false);

  const resolveSecret = useCallback(() => {
    const s = savedSecretKey.trim();
    if (s) return s;
    if (typeof window === 'undefined') return '';
    return (localStorage.getItem('authify_secret_key') || '').trim();
  }, [savedSecretKey]);

  const refreshMigration = useCallback(async () => {
    const secret = resolveSecret();
    if (!secret) {
      setMigrationPending(false);
      setMigrationItems([]);
      setPendingOAuthLegacyMigration(false);
      setLoading(false);
      return;
    }
    setLoadError(false);
    try {
      const res = await fetch(apiUrl('/api/oauth-configs/migration/legacy-redirects-status'), {
        credentials: 'include',
        headers: { 'X-Secret-API-Key': secret },
      });
      const raw = await res.text();
      let data: {
        success?: boolean;
        data?: { pending_migration?: boolean; pending?: PendingOAuthItem[] };
      } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        setLoadError(true);
        setMigrationPending(false);
        setMigrationItems([]);
        setPendingOAuthLegacyMigration(false);
        setLoading(false);
        return;
      }
      if (!res.ok || !data.success) {
        setLoadError(true);
        setMigrationPending(false);
        setMigrationItems([]);
        setPendingOAuthLegacyMigration(false);
        setLoading(false);
        return;
      }
      const pending = !!(data.data?.pending_migration && data.data?.pending?.length);
      setMigrationPending(!!data.data?.pending_migration);
      setMigrationItems(data.data?.pending ?? []);
      setPendingOAuthLegacyMigration(!!data.data?.pending_migration);
    } catch {
      setLoadError(true);
      setMigrationPending(false);
      setMigrationItems([]);
      setPendingOAuthLegacyMigration(false);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, resolveSecret, setPendingOAuthLegacyMigration]);

  useEffect(() => {
    setLoading(true);
    void refreshMigration();
  }, [refreshMigration]);

  const handleApplyMigration = async () => {
    const secret = resolveSecret();
    if (!secret) {
      showNotification(t('notifications.secretRequired'), 'error');
      return;
    }
    setApplyLoading(true);
    try {
      const res = await fetch(apiUrl('/api/oauth-configs/migration/legacy-redirects-apply'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Secret-API-Key': secret },
      });
      const raw = await res.text();
      let data: { success?: boolean; error?: { message?: string } } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        showNotification(t('oauth.errorConnection'), 'error');
        return;
      }
      if (data.success) {
        showNotification(t('oauth.migrationSuccess'), 'success');
        setMigrationPending(false);
        setMigrationItems([]);
        setPendingOAuthLegacyMigration(false);
      } else {
        showNotification(data.error?.message || t('oauth.migrationError'), 'error');
      }
    } catch {
      showNotification(t('oauth.errorConnection'), 'error');
    } finally {
      setApplyLoading(false);
    }
  };

  const secretConfigured = !!resolveSecret();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-8"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Bell className="size-7 text-primary shrink-0" />
            {t('notifications.title')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t('notifications.subtitle')}</p>
        </div>
      </div>

      {!secretConfigured && (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-sm text-muted-foreground">{t('notifications.secretRequired')}</CardContent>
        </Card>
      )}

      {secretConfigured && loadError && (
        <p className="text-sm text-destructive">{t('notifications.loadError')}</p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('notifications.pendingSection')}
        </h2>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="size-4 animate-spin" />
            {t('common.loading')}
          </div>
        ) : !secretConfigured ? null : migrationPending ? (
          <Card className="border-orange-500/40 bg-orange-500/5">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="size-4 text-orange-500 shrink-0" />
                    {t('notifications.oauthMigrationTitle')}
                  </CardTitle>
                  <CardDescription>{t('notifications.oauthMigrationBody')}</CardDescription>
                </div>
                <Badge variant="secondary" className="bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30">
                  {t('notifications.badgeWarning')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm space-y-2 rounded-md border border-border/80 bg-background/50 px-3 py-2">
                {migrationItems.map((item) => (
                  <li key={item.oauth_config_id} className="flex flex-wrap gap-x-2 gap-y-0.5">
                    <span className="font-medium capitalize">{item.provider}</span>
                    {item.name ? (
                      <span className="text-muted-foreground">({item.name})</span>
                    ) : null}
                    <span className="text-muted-foreground font-mono text-xs">· {item.oauth_config_id}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={handleApplyMigration}
                  disabled={applyLoading}
                  className="gap-2"
                >
                  {applyLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                  {applyLoading ? t('notifications.migrating') : t('oauth.runMigration')}
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={buildAdminHref('/oauth-providers')} className="gap-2">
                    {t('notifications.goToOAuthProviders')}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex items-center gap-2 pt-6 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              {t('notifications.emptyPending')}
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('notifications.recentSection')}
        </h2>
        <Card className={cn('border-dashed', 'opacity-80')}>
          <CardContent className="pt-6 text-sm text-muted-foreground">{t('notifications.emptyRecent')}</CardContent>
        </Card>
      </section>
    </motion.div>
  );
}
