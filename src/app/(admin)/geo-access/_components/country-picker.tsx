'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Checkbox, SearchInput, Text } from '@foundathyon/community-ui';
import { Button, IconButton } from '@/components/fdn/button';
import { useI18n } from '@/context/i18n-context';
import { allCountryOptions, countryFlag, countryName, foldText } from '@/lib/countries';
import { cn } from '@/lib/utils';

/**
 * Country picker: the chosen ones on top as chips (with a button to remove
 * them) and below the full list, searchable by name or code.
 */
export function CountryPicker({
  value,
  onChange,
  errors,
  disabled,
  invalid,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  /** Errors by index (`countries[i]`). */
  errors: Record<number, string>;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const { locale, t } = useI18n();
  const [query, setQuery] = useState('');
  const all = allCountryOptions(locale);
  const selected = new Set(value);

  const q = foldText(query.trim());
  const visible = q ? all.filter((c) => c.code.toLowerCase() === q || foldText(c.name).includes(q)) : all;

  const toggle = (code: string, on: boolean) =>
    onChange(on ? (selected.has(code) ? value : [...value, code]) : value.filter((c) => c !== code));

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-border p-2',
          invalid && 'border-danger-border',
        )}
      >
        {value.length === 0 ? (
          <Text variant="body-sm" tone="muted" className="px-1">{t('geoAccess.picker.none')}</Text>
        ) : (
          value.map((code, i) => {
            const name = countryName(code, locale);
            return (
              <span
                key={code}
                className={cn(
                  'inline-flex h-7 items-center gap-1 rounded-md border border-border bg-bg-subtle pl-2 text-body-sm',
                  errors[i] && 'border-danger-border text-danger',
                )}
                title={errors[i]}
              >
                <span aria-hidden>{countryFlag(code)}</span>
                {name}
                <IconButton
                  icon={X}
                  label={t('geoAccess.picker.remove', { name })}
                  variant="ghost"
                  size="xs"
                  onClick={() => toggle(code, false)}
                  disabled={disabled}
                />
              </span>
            );
          })
        )}
        {value.length > 1 && (
          <Button variant="ghost" size="xs" className="ml-auto" onClick={() => onChange([])} disabled={disabled}>
            {t('geoAccess.picker.removeAll')}
          </Button>
        )}
      </div>

      <div className="rounded-md border border-border">
        <div className="border-b border-border p-2">
          <SearchInput
            aria-label={t('geoAccess.picker.searchLabel')}
            placeholder={t('geoAccess.picker.searchPlaceholder')}
            clearLabel={t('common.clearSearch')}
            value={query}
            onValueChange={setQuery}
            disabled={disabled}
          />
        </div>
        <ul className="max-h-64 overflow-y-auto py-1" aria-label={t('geoAccess.picker.listLabel')}>
          {visible.length === 0 ? (
            <li className="px-3 py-2">
              <Text variant="body-sm" tone="muted">{t('geoAccess.picker.noResults', { query })}</Text>
            </li>
          ) : (
            visible.map((c) => (
              <li key={c.code} className="px-3 py-1.5 hover:bg-surface-hover">
                <Checkbox
                  label={
                    <span className="flex items-center gap-2">
                      <span aria-hidden>{c.flag}</span>
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span className="font-mono text-caption text-text-muted">{c.code}</span>
                    </span>
                  }
                  checked={selected.has(c.code)}
                  onCheckedChange={(checked) => toggle(c.code, checked === true)}
                  disabled={disabled}
                />
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
