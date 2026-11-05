'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Alert, Heading, Text } from '@foundathyon/community-ui';
import { EmailTemplatesEditor } from '@/components/email-templates/email-templates-editor';
import { ScreenLoadError, ScreenLoading } from '@/components/security-screen/screen-states';
import { SecurityScreen } from '@/components/security-screen/security-screen';
import { useAdmin } from '@/context/admin-context';
import { useEdition } from '@/context/edition-context';
import { useI18n } from '@/context/i18n-context';

/** The heading of the screens that do not need a secret key to open. */
function Frame({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-8">
        <Heading level={1} visual="h2">{title}</Heading>
        <Text variant="caption" tone="muted" className="mt-1 block max-w-2xl">{description}</Text>
      </div>
      {children}
    </motion.div>
  );
}

/**
 * Each edition can write to one route family only, so the edition picks the
 * scope and nothing is called until it is known: `isPro` is also false for an
 * unknown edition, hence `edition` here.
 */
export default function EmailTemplatesPage() {
  const { t } = useI18n();
  const { edition, loading } = useEdition();
  const { savedSecretKey } = useAdmin();
  const title = t('emailTemplates.title');

  if (edition === 'pro') {
    return (
      <SecurityScreen title={title} description={t('emailTemplates.subtitlePro')}>
        {(secretKey) => <EmailTemplatesEditor key={secretKey} secretKey={secretKey} senderKey={secretKey} />}
      </SecurityScreen>
    );
  }

  return (
    <Frame title={title} description={t('emailTemplates.subtitle')}>
      {loading ? (
        <ScreenLoading />
      ) : edition === null ? (
        <ScreenLoadError message={t('emailTemplates.editionUnknown')} onRetry={() => window.location.reload()} />
      ) : (
        <div className="space-y-6">
          <Alert tone="info" title={t('emailTemplates.community.title')}>
            {t('emailTemplates.community.body')}
          </Alert>
          <EmailTemplatesEditor secretKey={null} senderKey={savedSecretKey} />
        </div>
      )}
    </Frame>
  );
}
