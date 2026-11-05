'use client';

import { Text } from '@foundathyon/community-ui';
import { Button } from '@/components/fdn/button';
import { useI18n } from '@/context/i18n-context';
import { cn } from '@/lib/utils';

interface SaveFooterProps {
  dirty: boolean;
  saving: boolean;
  /** False while the draft has errors: Save stays disabled. */
  canSave?: boolean;
  /** Replaces the default "unsaved changes" text. */
  message?: string;
  danger?: boolean;
  onDiscard: () => void;
  onSave: () => void;
}

/**
 * Save bar of the security screens. Unlike the library's SaveBar it stays
 * visible with no changes and can disable Save when the draft is invalid.
 */
export function SaveFooter({ dirty, saving, canSave = true, message, danger, onDiscard, onSave }: SaveFooterProps) {
  const { t } = useI18n();
  return (
    <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-4 py-3">
      <Text variant="body-sm" tone="muted" className={cn(danger && 'text-danger')}>
        {message ?? (dirty ? t('securityScreens.dirty') : t('securityScreens.clean'))}
      </Text>
      <div className="flex shrink-0 gap-2">
        <Button variant="secondary" onClick={onDiscard} disabled={!dirty || saving}>
          {t('securityScreens.discard')}
        </Button>
        <Button variant="primary" onClick={onSave} disabled={!dirty || saving || !canSave} loading={saving}>
          {t('securityScreens.saveChanges')}
        </Button>
      </div>
    </div>
  );
}
