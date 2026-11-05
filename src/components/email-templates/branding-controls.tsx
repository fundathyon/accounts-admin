'use client';

import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { Check, Pipette } from 'lucide-react';
import { Heading, Icon, Text } from '@foundathyon/community-ui';
import { useI18n } from '@/context/i18n-context';
import { readableOn } from '@/lib/email-templates';
import { cn } from '@/lib/utils';

const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/** WAI-ARIA radio group: one tab stop, and the arrows move AND select. */
export function onRadioGroupKeyDown(event: KeyboardEvent<HTMLElement>) {
  const radios = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')];
  if (radios.length === 0) return;
  const from = radios.indexOf(document.activeElement as HTMLElement);
  let to: number;
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      to = (from + 1) % radios.length;
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
      to = (from - 1 + radios.length) % radios.length;
      break;
    case 'Home':
      to = 0;
      break;
    case 'End':
      to = radios.length - 1;
      break;
    default:
      return;
  }
  event.preventDefault();
  radios[to].focus();
  radios[to].click();
}

export function BrandingGroup({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-border px-4 py-4">
      <div>
        <Heading level={3} visual="h5">{title}</Heading>
        {description && <Text variant="body-sm" tone="muted" as="p" className="mt-0.5">{description}</Text>}
      </div>
      {children}
    </section>
  );
}

/** A compact single choice: radio semantics, segmented-button looks. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-md bg-surface-hover p-[3px]"
      onKeyDown={onRadioGroupKeyDown}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value || 'theme'}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-6 items-center gap-1 rounded-[5px] px-2.5 text-body-sm font-medium transition-colors',
              FOCUS_RING,
              selected ? 'bg-bg text-text shadow-sm' : 'text-text-muted hover:text-text',
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Swatch({
  color,
  label,
  selected,
  tabbable,
  badge,
  onSelect,
}: {
  color: string;
  label: string;
  selected: boolean;
  /** The group's only tab stop. */
  tabbable: boolean;
  badge?: string;
  onSelect: () => void;
}) {
  const ink = readableOn(color);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      tabIndex={tabbable ? 0 : -1}
      onClick={onSelect}
      className={cn(
        'relative flex size-6 items-center justify-center rounded-full border border-border-strong transition-shadow',
        FOCUS_RING,
        selected && 'ring-2 ring-text ring-offset-2 ring-offset-surface',
      )}
      style={{ backgroundColor: color, color: ink }}
    >
      {selected ? <Check className="size-3.5" strokeWidth={3} /> : badge && <span className="text-[9px] font-bold">{badge}</span>}
    </button>
  );
}

/** Opens the system colour picker; selected when the accent is not a preset. */
export function CustomColor({
  value,
  fallback,
  onChange,
}: {
  value: string;
  fallback: string;
  onChange: (color: string) => void;
}) {
  const { t } = useI18n();
  const selected = !!value;
  const current = value || fallback;
  return (
    <label
      title={t('emailTemplates.branding.accent.custom')}
      className={cn(
        'relative flex size-6 cursor-pointer items-center justify-center rounded-full border border-dashed border-border-strong transition-shadow',
        'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus',
        selected && 'border-solid ring-2 ring-text ring-offset-2 ring-offset-surface',
      )}
      style={selected ? { backgroundColor: value, color: readableOn(value) } : undefined}
    >
      {selected ? <Check className="size-3.5" strokeWidth={3} /> : <Icon icon={Pipette} size={12} className="text-text-muted" />}
      <input
        type="color"
        aria-label={t('emailTemplates.branding.accent.custom')}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
        value={/^#[0-9a-f]{6}$/.test(current) ? current : '#000000'}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function LogoPreview({ url }: { url: string }) {
  const { t } = useI18n();
  const [brokenUrl, setBrokenUrl] = useState('');
  const broken = url !== '' && brokenUrl === url;
  return (
    <div
      className="flex h-control-md w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-bg-subtle"
      aria-hidden
    >
      {url && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary external URL typed by the operator
        <img src={url} alt="" className="max-h-6 max-w-14 object-contain" onError={() => setBrokenUrl(url)} />
      ) : (
        <Text variant="caption" tone="muted">{url ? t('emailTemplates.branding.logo.noImage') : '—'}</Text>
      )}
    </div>
  );
}
