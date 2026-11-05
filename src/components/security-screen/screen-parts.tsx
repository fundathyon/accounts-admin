'use client';

import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Card, CardBody, Heading, Icon, Text } from '@foundathyon/community-ui';
import { useI18n } from '@/context/i18n-context';

/** Title and hint of a settings card; `id` labels the control group below it. */
export function SectionHeading({ id, title, description }: { id?: string; title: string; description: string }) {
  return (
    <div className="space-y-0.5">
      <Heading id={id} level={2} visual="h5">{title}</Heading>
      <Text variant="body-sm" tone="muted" as="p">{description}</Text>
    </div>
  );
}

/** The sentence that sums up the draft, live. */
export function ResultCard({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <Card>
      <CardBody className="space-y-2">
        <Text variant="overline" tone="muted" as="p">{t('securityScreens.result')}</Text>
        <Text as="p" className="font-medium">{children}</Text>
      </CardBody>
    </Card>
  );
}

export function ScreenNotes({ notes }: { notes: ReactNode[] }) {
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      {notes.map((note, i) => (
        <Text key={i} variant="body-sm" tone="muted" as="p" className="flex items-start gap-2">
          <Icon icon={Info} size={16} className="mt-0.5 shrink-0" />
          <span>{note}</span>
        </Text>
      ))}
    </div>
  );
}
