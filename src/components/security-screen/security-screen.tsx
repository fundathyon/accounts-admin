'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Key, MapPin } from 'lucide-react';
import { Card, EmptyState, Heading, Icon, Spinner, Text } from '@foundathyon/community-ui';
import { buttonVariants } from '@/components/fdn/button';
import { Badge } from '@/components/fdn/badge';
import { useAdmin } from '@/context/admin-context';
import { useEdition } from '@/context/edition-context';
import { useI18n } from '@/context/i18n-context';
import { buildAdminHref, cn } from '@/lib/utils';

interface SecurityScreenProps {
  title: string;
  description: ReactNode;
  /** Set on Pro-only screens: outside Pro, the editor (and so its API calls) never mounts. */
  proOnlyDescription?: string;
  children: (secretKey: string) => ReactNode;
}

/** Page frame of the security screens: heading, Pro gate and "no secret key" state. */
export function SecurityScreen({ title, description, proOnlyDescription, children }: SecurityScreenProps) {
  const { t } = useI18n();
  const { isPro, loading: editionLoading } = useEdition();
  const { savedSecretKey } = useAdmin();
  const proOnly = proOnlyDescription !== undefined;
  const available = !proOnly || isPro;
  const settingsHref = buildAdminHref('/settings');

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <Heading level={1} visual="h2" className="flex items-center gap-3">
            {title}
            {proOnly && <Badge variant="outline" tone="info">{t('securityScreens.proBadge')}</Badge>}
          </Heading>
          <Text variant="caption" tone="muted" className="mt-1 block max-w-2xl">
            {description}
          </Text>
        </div>
        {available && !savedSecretKey && (
          <Link
            href={settingsHref}
            className={cn(
              buttonVariants({ variant: 'secondary' }),
              'gap-2 border-warning-border text-warning hover:bg-warning-bg'
            )}
          >
            <Icon icon={Key} size={16} /> {t('securityScreens.configSecretKey')}
          </Link>
        )}
      </div>

      {proOnly && editionLoading ? (
        <div className="py-20 flex justify-center">
          <Spinner size={20} label={t('common.loading')} className="text-accent" />
        </div>
      ) : !available ? (
        <Card>
          <EmptyState
            icon={MapPin}
            title={t('securityScreens.proOnlyTitle')}
            description={proOnlyDescription}
            action={
              <Link href={buildAdminHref('/')} className={cn(buttonVariants({ variant: 'secondary' }))}>
                {t('securityScreens.backToDashboard')}
              </Link>
            }
          />
        </Card>
      ) : !savedSecretKey ? (
        <Card className="border-warning-border">
          <EmptyState
            icon={Key}
            title={<span className="text-warning">{t('securityScreens.secretKeyRequired')}</span>}
            description={t('securityScreens.secretKeyRequiredDesc')}
            action={
              <Link href={settingsHref} className={cn(buttonVariants({ variant: 'primary' }))}>
                {t('users.goToSettings')}
              </Link>
            }
          />
        </Card>
      ) : (
        children(savedSecretKey)
      )}
    </motion.div>
  );
}
