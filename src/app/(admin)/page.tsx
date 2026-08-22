'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Webhook, Puzzle, Key, Shield, LogIn } from 'lucide-react';
import { useI18n } from '@/context/i18n-context';
import { motion } from 'framer-motion';
import { Badge, Card, Heading, Inline, Text } from '@foundathyon/community-ui';
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
      {/* Explicit 1/2/3-column breakpoints kept on purpose: community-ui's `Grid`
          is `auto-fit`/`minmax`, which would grow past three columns on wide
          viewports and change this layout. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {[
          { icon: Users, labelKey: 'sidebar.users', value: stats.users, href: '/users' },
          { icon: Webhook, labelKey: 'sidebar.webhooks', value: stats.webhooks, href: '/webhooks' },
          { icon: Puzzle, labelKey: 'sidebar.behaviors', value: stats.behaviors, href: '/behaviors' },
          { icon: Key, labelKey: 'sidebar.apiKeys', value: stats.api_keys, href: '/api-keys' },
          { icon: Shield, labelKey: 'sidebar.roles', value: stats.roles, href: '/roles-policies' },
          { icon: LogIn, labelKey: 'sidebar.oauthProviders', value: stats.oauth_configs, href: '/oauth-providers' },
        ].map((card) => (
          <Link key={card.labelKey} href={buildHref(card.href)}>
            <Card interactive className="p-6 cursor-pointer h-full">
              {/* `primary` (the app's cyan) is kept deliberately: community-ui's
                  `.text-accent` is shadowed by the app's shadcn `--accent`
                  (a neutral grey) because globals.css loads last. */}
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                <card.icon className="w-6 h-6" />
              </div>
              <Text as="div" variant="label" tone="muted">
                {t(card.labelKey)}
              </Text>
              <Text as="div" tabular className="text-h1 mt-1">
                {loading ? '…' : card.value}
              </Text>
            </Card>
          </Link>
        ))}
      </div>
    </motion.div>
  );
}
