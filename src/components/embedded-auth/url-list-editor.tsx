'use client';

import { MinusCircle, Plus } from 'lucide-react';
import { Button, FormField, IconButton, Input, Text } from '@foundathyon/community-ui';

interface UrlListEditorProps {
  /** Group label, e.g. "Orígenes permitidos". */
  label: string;
  description?: string;
  values: string[];
  onChange: (values: string[]) => void;
  max: number;
  placeholder: string;
  addLabel: string;
  removeLabel: string;
  /** Accessible label of row `i` (the visible group label sits above the list). */
  rowLabel: (index: number) => string;
  /** Error under row `i`, or null. */
  rowError: (index: number) => string | null;
  /** Neutral hint under row `i` when it has no error (e.g. the canonical form). */
  rowHint?: (index: number) => string | null;
  /** Error about the list as a whole ("at least one origin"). */
  listError?: string | null;
  /** Copy for the "n of max" counter. */
  countLabel: string;
  emptyLabel: string;
}

/**
 * Editable list of URLs — one Input per row plus a remove button, and an "add"
 * button below (the same pattern as the OAuth redirect whitelist). Rows keep
 * their index as key: inputs are controlled, so removing one just shifts values.
 */
export function UrlListEditor({
  label,
  description,
  values,
  onChange,
  max,
  placeholder,
  addLabel,
  removeLabel,
  rowLabel,
  rowError,
  rowHint,
  listError,
  countLabel,
  emptyLabel,
}: UrlListEditorProps) {
  const update = (index: number, value: string) => {
    const next = [...values];
    next[index] = value;
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Text variant="label" as="div">{label}</Text>
          {description && (
            <Text variant="caption" tone="muted" as="div" className="mt-0.5">
              {description}
            </Text>
          )}
        </div>
        <Text variant="caption" tone="muted" tabular className="shrink-0">
          {countLabel}
        </Text>
      </div>

      {values.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-3">
          <Text variant="caption" tone="muted">{emptyLabel}</Text>
        </div>
      ) : (
        <div className="space-y-2">
          {values.map((value, index) => {
            const error = rowError(index);
            const hint = error ? null : rowHint?.(index) ?? null;
            return (
              <div key={index} className="flex items-start gap-2">
                <FormField
                  className="flex-1 min-w-0"
                  label={<span className="sr-only">{rowLabel(index)}</span>}
                  error={error ?? undefined}
                  description={hint ?? undefined}
                >
                  <Input
                    value={value}
                    onChange={(e) => update(index, e.target.value)}
                    placeholder={placeholder}
                    spellCheck={false}
                    autoComplete="off"
                    inputMode="url"
                    aria-label={rowLabel(index)}
                    className="font-mono text-xs"
                    invalid={!!error}
                  />
                </FormField>
                <IconButton
                  type="button"
                  icon={MinusCircle}
                  label={removeLabel}
                  variant="ghost"
                  // mt-1.5 = the FormField's gap under its (visually hidden) label,
                  // so the button lines up with the input.
                  className="mt-1.5 shrink-0 text-muted-foreground hover:text-danger"
                  onClick={() => onChange(values.filter((_, i) => i !== index))}
                />
              </div>
            );
          })}
        </div>
      )}

      {listError && (
        <Text variant="caption" as="div" className="text-danger" role="alert">
          {listError}
        </Text>
      )}

      <Button
        type="button"
        variant="secondary"
        size="sm"
        leading={<Plus className="w-4 h-4" />}
        disabled={values.length >= max}
        onClick={() => onChange([...values, ''])}
      >
        {addLabel}
      </Button>
    </div>
  );
}
