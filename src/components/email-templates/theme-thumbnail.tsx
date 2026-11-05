'use client';

import type { CSSProperties } from 'react';
import { Check } from 'lucide-react';
import { Text } from '@foundathyon/community-ui';
import { useI18n } from '@/context/i18n-context';
import { normalizeHex, type EmailBranding, type EmailTheme } from '@/lib/email-templates';
import { cn } from '@/lib/utils';

const RADII = {
  sharp: { card: 0, button: 0 },
  soft: { card: 6, button: 3 },
  round: { card: 10, button: 999 },
} as const;

/**
 * A miniature of the email a theme renders, drawn from its tokens with the
 * draft branding layered on top, so picking a theme shows how it looks with
 * your accent and corners without rendering one iframe per theme. Its colours
 * are the theme's data, not admin tokens.
 */
export function ThemeThumbnail({
  theme,
  branding,
  selected,
  active,
  tabbable,
  onSelect,
}: {
  theme: EmailTheme;
  branding: EmailBranding;
  selected: boolean;
  active: boolean;
  /** The group's only tab stop. */
  tabbable: boolean;
  onSelect: () => void;
}) {
  const { t } = useI18n();
  const tokens = theme.tokens;
  const brandAccent = normalizeHex(branding.accent_color ?? '');
  const accent = /^#[0-9a-f]{6}$/.test(brandAccent) ? brandAccent : tokens.accent;
  const radii = RADII[branding.corners ?? tokens.corners] ?? RADII.soft;
  const center = tokens.align === 'center';
  const bar = (width: string, color: string, height = 3): CSSProperties => ({
    width,
    height,
    borderRadius: 2,
    backgroundColor: color,
    marginInline: center ? 'auto' : undefined,
  });

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={theme.name}
      tabIndex={tabbable ? 0 : -1}
      onClick={onSelect}
      className="group flex min-w-0 flex-col gap-1.5 rounded-lg p-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <div
        className={cn(
          'relative aspect-[4/3] w-full overflow-hidden rounded-md border transition-colors',
          selected ? 'border-accent-solid ring-2 ring-accent-border' : 'border-border group-hover:border-border-strong',
        )}
        style={{ backgroundColor: tokens.canvas }}
      >
        <div className="absolute inset-x-[14%] top-[12%] flex flex-col gap-[5px]">
          <div className={cn('flex items-center gap-1', center && 'justify-center')}>
            <div className="flex flex-col gap-[1.5px]">
              <span style={{ ...bar('9px', tokens.heading, 2), marginInline: undefined }} />
              <span style={{ ...bar('6px', tokens.heading, 2), marginInline: undefined }} />
              <span style={{ ...bar('3px', tokens.heading, 2), marginInline: undefined }} />
            </div>
            <span style={{ ...bar('22px', tokens.heading, 3), marginInline: undefined }} />
          </div>
          <div
            className="overflow-hidden border"
            style={{ backgroundColor: tokens.surface, borderColor: tokens.border, borderRadius: radii.card }}
          >
            {tokens.top_bar && <div style={{ height: 3, backgroundColor: accent }} />}
            <div className="flex flex-col gap-[5px] px-[10%] py-[9%]">
              <span style={bar('58%', tokens.heading, 4)} />
              <span style={bar('86%', tokens.muted, 2)} />
              <span style={bar('72%', tokens.muted, 2)} />
              <span className="mt-[3px]" style={{ ...bar('40%', accent, 9), borderRadius: radii.button }} />
            </div>
          </div>
        </div>
        {active && (
          <span className="absolute right-1.5 top-1.5 rounded-sm bg-bg px-1 text-caption font-medium text-text shadow-sm">
            {t('emailTemplates.branding.active')}
          </span>
        )}
        {selected && (
          <span className="absolute bottom-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-accent-solid text-accent-on-solid">
            <Check className="size-3" strokeWidth={3} />
          </span>
        )}
      </div>
      <Text variant="body-sm" tone={selected ? undefined : 'muted'} className={cn('truncate px-0.5', selected && 'font-medium')}>
        {theme.name}
      </Text>
    </button>
  );
}
