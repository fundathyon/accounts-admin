'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ScrollText } from 'lucide-react';
import { useI18n } from '@/context/i18n-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
      <h3 className="text-sm font-semibold tracking-tight text-foreground border-b border-border/60 pb-1.5">
        {title}
      </h3>
      {children}
    </section>
  );
}

function BulletList({ keys, prefix }: { keys: readonly string[]; prefix: string }) {
  const { t } = useI18n();
  return (
    <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground/90">
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
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <ScrollText className="size-8" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">{t('releaseNotes.title')}</h1>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">{t('releaseNotes.subtitle')}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('releaseNotes.v020Title')}</CardTitle>
            <CardDescription>{t('releaseNotes.v020Date')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <p className="text-sm leading-relaxed text-foreground/90">{t('releaseNotes.v020.intro')}</p>

            <Subsection title={t('releaseNotes.v020.sections.oauthApi.title')}>
              <p className="text-sm leading-relaxed text-muted-foreground">{t('releaseNotes.v020.sections.oauthApi.lead')}</p>
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
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('releaseNotes.v010Title')}</CardTitle>
            <CardDescription>{t('releaseNotes.v010Date')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <p className="text-sm leading-relaxed text-foreground/90">{t('releaseNotes.v010.intro')}</p>

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
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
