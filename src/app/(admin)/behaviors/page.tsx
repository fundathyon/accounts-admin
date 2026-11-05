'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Puzzle, Key, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, Heading, Spinner, Text } from '@foundathyon/community-ui';
import { buttonVariants } from '@/components/fdn/button';
import { Badge } from '@/components/fdn/badge';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { BASE_PATH } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { AppBehavior } from '@/lib/admin-types';

function truncateKey(key: string) {
  if (!key || key.length <= 20) return key;
  return key.slice(0, 12) + '••••••••••••' + key.slice(-8);
}

export default function BehaviorsPage() {
  const { apiUrl, showNotification, savedSecretKey } = useAdmin();
  const { t } = useI18n();
  const [behaviors, setBehaviors] = useState<AppBehavior[]>([]);
  const [loading, setLoading] = useState(true);

  const settingsHref = `${BASE_PATH}/settings`.replace(/\/+/g, '/') || '/settings';
  const behaviorsHref = (id: string) => `${BASE_PATH}/behaviors/${id}`.replace(/\/+/g, '/');

  const fetchBehaviors = async () => {
    if (!savedSecretKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/behaviors'), { headers: { 'X-Secret-API-Key': savedSecretKey } });
      const data = await res.json();
      if (data.success) setBehaviors(data.data || []);
      else showNotification(data.error?.message || t('behaviors.errorLoad'), 'error');
    } catch {
      showNotification(t('users.errorConnectionUsers'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBehaviors();
  }, [savedSecretKey]);

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-h2 font-semibold tracking-tight">{t('sidebar.behaviors')}</h1>
            <p className="text-text-muted text-body mt-1">{t('behaviors.desc')}</p>
          </div>
          {!savedSecretKey && (
            <Link
              href={settingsHref}
              className={cn(
                buttonVariants({ variant: 'secondary', size: 'sm' }),
                'gap-2 border-warning-border text-warning hover:bg-warning-bg'
              )}
            >
              <Key className="w-4 h-4" /> {t('behaviors.configSecretKey')}
            </Link>
          )}
        </div>

        {!savedSecretKey ? (
          <Card className="border-warning-border gap-6 p-12 text-center">
            <div className="w-16 h-16 rounded-lg bg-warning-bg flex items-center justify-center mx-auto mb-4">
              <Key className="w-8 h-8 text-warning" />
            </div>
            <Heading level={2} visual="h3" className="text-warning mb-2">
              {t('behaviors.secretKeyRequired')}
            </Heading>
            <Text tone="secondary" className="mb-6">
              {t('behaviors.secretKeyRequiredDesc')}
            </Text>
            <Link href={settingsHref} className={buttonVariants({ variant: 'primary', size: 'sm' })}>
              {t('users.goToSettings')}
            </Link>
          </Card>
        ) : loading ? (
          <div className="py-20 flex justify-center">
            <Spinner size={20} label={t('common.loading')} className="text-text-muted" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="px-6 py-3 bg-bg-subtle border border-border rounded-lg flex items-center gap-2 text-xs text-text-muted">
              <ShieldCheck className="w-4 h-4" /> {t('roles.consultingWith')} <span className="font-mono">{truncateKey(savedSecretKey)}</span>
            </div>

            {behaviors.length === 0 ? (
              <Card className="border-dashed gap-6 p-16 text-center">
                <div className="w-16 h-16 rounded-lg bg-danger-bg flex items-center justify-center mx-auto mb-4">
                  <Puzzle className="w-8 h-8 text-text-muted" />
                </div>
                <Heading level={2} visual="h3" className="mb-2">
                  {t('behaviors.noBehaviors')}
                </Heading>
                <Text tone="secondary">{t('behaviors.noBehaviorsDesc')}</Text>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {behaviors.map((behavior) => (
                  <Link key={behavior.id} href={behaviorsHref(behavior.id)}>
                    <Card className="gap-6 p-6 cursor-pointer hover:border-accent-border transition-all group">
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-lg border border-border bg-bg-subtle flex items-center justify-center text-text-muted group-hover:scale-110 transition-transform">
                          <Puzzle className="w-5 h-5" />
                        </div>
                        <Badge
                          variant="tonal"
                          tone={behavior.is_active ? 'success' : 'neutral'}
                        >
                          {behavior.is_active ? t('common.active') : t('behaviors.inactive')}
                        </Badge>
                      </div>

                      <Heading level={3} visual="h3" className="mb-1">
                        {behavior.behavior_code}
                      </Heading>
                      <p className="text-xs text-text-muted font-mono mb-4">{behavior.id}</p>

                      <div className="text-xs text-text-muted mt-auto pt-4 border-t border-border flex flex-col gap-1">
                        <div className="flex justify-between">
                          <span>{t('behaviors.updated')}:</span>
                          <span className="text-text">{new Date(behavior.updated_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t('behaviors.created')}:</span>
                          <span className="text-text">{new Date(behavior.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </>
  );
}
