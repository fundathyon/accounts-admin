'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ScrollText } from 'lucide-react';
import { useI18n } from '@/context/i18n-context';
import { Card, CardBody, CardHeader, Heading, Inline, Stack, Text } from '@foundathyon/community-ui';
import { cn } from '@/lib/utils';

function Subsection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-3', className)}>
      <Heading level={3} visual="h5" className="tracking-tight border-b border-border/60 pb-1.5">
        {title}
      </Heading>
      {children}
    </section>
  );
}

function BulletList({ keys, prefix }: { keys: readonly string[]; prefix: string }) {
  const { t } = useI18n();
  return (
    <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-text/90">
      {keys.map((key) => (
        <li key={key}>{t(`${prefix}.${key}`)}</li>
      ))}
    </ul>
  );
}

export default function ReleaseNotesPage() {
  const { t } = useI18n();

  const v020OAuthKeys = ['i1', 'i2', 'i3', 'i4', 'i5'] as const;
  const v020RedirectsKeys = ['i1', 'i2', 'i3'] as const;
  const v020AdminKeys = ['i1', 'i2', 'i3'] as const;
  const v020UsersKeys = ['i1', 'i2'] as const;
  const v020MetaKeys = ['i1', 'i2'] as const;

  const v010FoundationKeys = ['i1', 'i2'] as const;
  const v010AuthKeys = ['i1', 'i2'] as const;
  const v010OauthKeys = ['i1', 'i2'] as const;
  const v010ExperienceKeys = ['i1', 'i2'] as const;

  return (
    <Stack gap={8} className="mx-auto max-w-3xl p-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
        <Inline gap={2} className="text-accent">
          <ScrollText className="size-8" aria-hidden />
          {/* text-accent repeated on the Heading: `Heading` paints `text-text`,
              which would otherwise override the colour inherited from the row. */}
          <Heading level={1} visual="h2" className="text-accent">
            {t('releaseNotes.title')}
          </Heading>
        </Inline>
        <Text tone="secondary" className="leading-relaxed">
          {t('releaseNotes.subtitle')}
        </Text>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card>
          <CardHeader>
            <Stack gap={2}>
              <Heading level={2} visual="h3">
                {t('releaseNotes.v020Title')}
              </Heading>
              <Text tone="secondary">{t('releaseNotes.v020Date')}</Text>
            </Stack>
          </CardHeader>
          <CardBody>
            <Stack gap={8}>
              <Text className="leading-relaxed text-text/90">{t('releaseNotes.v020.intro')}</Text>

              <Subsection title={t('releaseNotes.v020.sections.oauthApi.title')}>
                <Text tone="secondary" className="leading-relaxed">
                  {t('releaseNotes.v020.sections.oauthApi.lead')}
                </Text>
                <BulletList keys={v020OAuthKeys} prefix="releaseNotes.v020.sections.oauthApi" />
              </Subsection>

              <Subsection title={t('releaseNotes.v020.sections.redirects.title')}>
                <BulletList keys={v020RedirectsKeys} prefix="releaseNotes.v020.sections.redirects" />
              </Subsection>

              <Subsection title={t('releaseNotes.v020.sections.adminUi.title')}>
                <BulletList keys={v020AdminKeys} prefix="releaseNotes.v020.sections.adminUi" />
              </Subsection>

              <Subsection title={t('releaseNotes.v020.sections.usersBranding.title')}>
                <BulletList keys={v020UsersKeys} prefix="releaseNotes.v020.sections.usersBranding" />
              </Subsection>

              <Subsection title={t('releaseNotes.v020.sections.meta.title')}>
                <BulletList keys={v020MetaKeys} prefix="releaseNotes.v020.sections.meta" />
              </Subsection>
            </Stack>
          </CardBody>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader>
            <Stack gap={2}>
              <Heading level={2} visual="h3">
                {t('releaseNotes.v010Title')}
              </Heading>
              <Text tone="secondary">{t('releaseNotes.v010Date')}</Text>
            </Stack>
          </CardHeader>
          <CardBody>
            <Stack gap={8}>
              <Text className="leading-relaxed text-text/90">{t('releaseNotes.v010.intro')}</Text>

              <Subsection title={t('releaseNotes.v010.sections.foundation.title')}>
                <BulletList keys={v010FoundationKeys} prefix="releaseNotes.v010.sections.foundation" />
              </Subsection>

              <Subsection title={t('releaseNotes.v010.sections.security.title')}>
                <BulletList keys={v010AuthKeys} prefix="releaseNotes.v010.sections.security" />
              </Subsection>

              <Subsection title={t('releaseNotes.v010.sections.oauthGoogle.title')}>
                <BulletList keys={v010OauthKeys} prefix="releaseNotes.v010.sections.oauthGoogle" />
              </Subsection>

              <Subsection title={t('releaseNotes.v010.sections.experience.title')}>
                <BulletList keys={v010ExperienceKeys} prefix="releaseNotes.v010.sections.experience" />
              </Subsection>
            </Stack>
          </CardBody>
        </Card>
      </motion.div>
    </Stack>
  );
}
