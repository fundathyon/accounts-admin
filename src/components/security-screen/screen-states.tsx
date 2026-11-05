'use client';

import { Alert, Card, ErrorState, Spinner } from '@foundathyon/community-ui';
import { useI18n } from '@/context/i18n-context';

export function ScreenLoading() {
  const { t } = useI18n();
  return (
    <div className="py-20 flex justify-center">
      <Spinner size={20} label={t('common.loading')} className="text-accent" />
    </div>
  );
}

export function ScreenLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <Card>
      <ErrorState
        title={message}
        retry={{ label: t('common.retry'), onClick: onRetry }}
        copyLabel={t('common.copy')}
        copiedLabel={t('common.copied')}
      />
    </Card>
  );
}

/** The backend answered 404: it predates this setting. */
export function ScreenUnavailable({ title, body }: { title: string; body: string }) {
  return (
    <Alert tone="warning" title={title}>
      {body}
    </Alert>
  );
}
