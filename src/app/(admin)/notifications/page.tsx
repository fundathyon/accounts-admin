'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Bell, CheckCircle2 } from 'lucide-react';
import {
  Badge,
  Button,
  buttonVariants,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Icon,
  Inline,
  Spinner,
  Stack,
  Text,
} from '@foundathyon/community-ui';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { buildAdminHref, cn } from '@/lib/utils';

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
          <Heading level={1} visual="h2" className="flex items-center gap-2">
            <Bell className="size-7 text-accent shrink-0" />
            {t('notifications.title')}
          </Heading>
          <Text tone="secondary" className="mt-1">
            {t('notifications.subtitle')}
          </Text>
        </div>
      </div>

      {!secretConfigured && (
        <Card className="border-dashed">
          <CardBody>
            <Text tone="secondary">{t('notifications.secretRequired')}</Text>
          </CardBody>
        </Card>
      )}

      {secretConfigured && loadError && (
        <Text className="text-danger">{t('notifications.loadError')}</Text>
      )}

      <section className="space-y-3">
        <Heading level={2} visual="h5" className="uppercase tracking-wide text-muted-foreground">
          {t('notifications.pendingSection')}
        </Heading>
        {loading ? (
          <Inline gap={2} className="text-muted-foreground">
            <Spinner size={16} label={null} />
            <Text tone="muted">{t('common.loading')}</Text>
          </Inline>
        ) : !secretConfigured ? null : migrationPending ? (
          <Card className="border-orange-500/40 bg-orange-500/5">
            <CardHeader
              actions={
                <Badge variant="tonal" tone="warning">
                  {t('notifications.badgeWarning')}
                </Badge>
              }
            >
              <Stack gap={1}>
                <Heading level={3} visual="h4" className="flex items-center gap-2">
                  <Icon icon={AlertTriangle} size={16} className="text-orange-500" />
                  {t('notifications.oauthMigrationTitle')}
                </Heading>
                <Text tone="secondary">{t('notifications.oauthMigrationBody')}</Text>
              </Stack>
            </CardHeader>
            <CardBody>
              <Stack gap={4}>
                <ul className="text-sm space-y-2 rounded-md border border-border/80 bg-bg/50 px-3 py-2">
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
                <Inline gap={2} wrap>
                  {/* Deliberately NOT Button's `loading`: it renders its children
                      `invisible` behind the spinner, which would hide the
                      `notifications.migrating` copy this button swaps in. */}
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleApplyMigration}
                    disabled={applyLoading}
                    leading={applyLoading ? <Spinner size={14} label={null} /> : undefined}
                  >
                    {applyLoading ? t('notifications.migrating') : t('oauth.runMigration')}
                  </Button>
                  {/* community-ui's Button has no `asChild`; `buttonVariants` is the
                      supported way to give a router link the button surface. */}
                  <Link
                    href={buildAdminHref('/oauth-providers')}
                    className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                  >
                    {t('notifications.goToOAuthProviders')}
                    <Icon icon={ArrowRight} size={14} />
                  </Link>
                </Inline>
              </Stack>
            </CardBody>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardBody>
              <Inline gap={2}>
                <Icon icon={CheckCircle2} size={16} className="text-emerald-500" />
                <Text tone="secondary">{t('notifications.emptyPending')}</Text>
              </Inline>
            </CardBody>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <Heading level={2} visual="h5" className="uppercase tracking-wide text-muted-foreground">
          {t('notifications.recentSection')}
        </Heading>
        <Card className={cn('border-dashed', 'opacity-80')}>
          <CardBody>
            <Text tone="secondary">{t('notifications.emptyRecent')}</Text>
          </CardBody>
        </Card>
      </section>
    </motion.div>
  );
}
