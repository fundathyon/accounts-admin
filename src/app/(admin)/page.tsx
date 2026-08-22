'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Webhook, Puzzle, Key, Shield, LogIn } from 'lucide-react';
import { useI18n } from '@/context/i18n-context';
import { motion } from 'framer-motion';
import { Badge, Heading, Icon, Inline, StatCard } from '@foundathyon/community-ui';
import { useAdmin } from '@/context/admin-context';
import { BASE_PATH } from '@/lib/utils';

function buildHref(path: string) {
  return path === '/' ? `${BASE_PATH || '/'}` : `${BASE_PATH}${path}`.replace(/\/+/g, '/') || '/';
}

type DashboardStats = {
  users: number;
  webhooks: number;
  behaviors: number;
  api_keys: number;
  roles: number;
  oauth_configs: number;
};

export default function DashboardPage() {
  const { apiUrl, savedSecretKey } = useAdmin();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    users: 0,
    webhooks: 0,
    behaviors: 0,
    api_keys: 0,
    roles: 0,
    oauth_configs: 0,
  });

  useEffect(() => {
    setLoading(true);
    if (!savedSecretKey) {
      setLoading(false);
      return;
    }
    fetch(apiUrl('/api/dashboard-stats'), {
      headers: { 'X-Secret-API-Key': savedSecretKey },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setStats({
            users: data.data.users ?? 0,
            webhooks: data.data.webhooks ?? 0,
            behaviors: data.data.behaviors ?? 0,
            api_keys: data.data.api_keys ?? 0,
            roles: data.data.roles ?? 0,
            oauth_configs: data.data.oauth_configs ?? 0,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [savedSecretKey, apiUrl]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Inline gap={3} className="mb-8">
        <Heading level={1}>{t('dashboard.title')}</Heading>
        <Badge variant="outline">{t('dashboard.badge')}</Badge>
      </Inline>
      {/* The column count comes from a CSS var rather than `sm:grid-cols-2
          md:grid-cols-3`: community-ui's stylesheet loads last and also emits
          `sm:grid-cols-2`, which at equal specificity beat `md:grid-cols-3` and
          pinned this grid to two columns on desktop. See src/app/globals.css. */}
      <div className="dashboard-stat-grid">
        {[
          { icon: Users, labelKey: 'sidebar.users', value: stats.users, href: '/users' },
          { icon: Webhook, labelKey: 'sidebar.webhooks', value: stats.webhooks, href: '/webhooks' },
          { icon: Puzzle, labelKey: 'sidebar.behaviors', value: stats.behaviors, href: '/behaviors' },
          { icon: Key, labelKey: 'sidebar.apiKeys', value: stats.api_keys, href: '/api-keys' },
          { icon: Shield, labelKey: 'sidebar.roles', value: stats.roles, href: '/roles-policies' },
          { icon: LogIn, labelKey: 'sidebar.oauthProviders', value: stats.oauth_configs, href: '/oauth-providers' },
        ].map((card) => (
          <Link key={card.labelKey} href={buildHref(card.href)} className="group">
            {/* §14 Stat/Metric: overline label on top, big figure below. No
                delta is passed because dashboard-stats returns bare counts —
                the API has no previous-period figure to compare against, and
                §14 requires a delta to carry its own period to mean anything. */}
            <StatCard
              label={
                <span className="inline-flex items-center gap-1.5">
                  <Icon icon={card.icon} size={14} />
                  {t(card.labelKey)}
                </span>
              }
              value={loading ? '—' : card.value}
              className="h-full transition-colors duration-150 group-hover:bg-surface-hover"
            />
          </Link>
        ))}
      </div>
    </motion.div>
  );
}
