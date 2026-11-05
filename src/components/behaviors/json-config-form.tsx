'use client';

import { useState } from 'react';
import { FormField, Textarea } from '@foundathyon/community-ui';
import { Button } from '@/components/fdn/button';
import { useI18n } from '@/context/i18n-context';

/** Parses a JSON object, or null when the text is anything else. */
export function parseConfigObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

interface JsonConfigFormProps {
  initialConfig: Record<string, unknown>;
  onSave: (config: Record<string, unknown>) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

/** Editor of a behavior without a form of its own, written with the generic PUT. */
export function JsonConfigForm({ initialConfig, onSave, onCancel, isSubmitting }: JsonConfigFormProps) {
  const { t } = useI18n();
  const [text, setText] = useState(() => JSON.stringify(initialConfig, null, 2));
  const parsed = parseConfigObject(text);

  return (
    <div className="space-y-4 h-full flex flex-col">
      <FormField
        className="flex-1"
        label={t('behaviors.configJson')}
        description={t('behaviors.jsonEditorHelp')}
        error={parsed ? undefined : t('behaviors.invalidJson')}
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={16}
          spellCheck={false}
          className="font-mono text-xs"
        />
      </FormField>
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" onClick={() => parsed && onSave(parsed)} disabled={!parsed || isSubmitting}>
          {isSubmitting ? t('behaviors.saving') : t('behaviors.saveChanges')}
        </Button>
      </div>
    </div>
  );
}
