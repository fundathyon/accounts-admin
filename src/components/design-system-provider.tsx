'use client';

import type { ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { FoundathyonProvider } from '@foundathyon/community-ui';
import { BRAND_ACCENT } from '@/lib/brand';

/**
 * Mounts the design system with next-themes as the single theme owner.
 *
 * The two systems read different things — next-themes uses `attribute="class"`
 * (which the remaining shadcn styles and globals.css's `@custom-variant dark`
 * depend on), while the design system switches its `--fdn-*` tokens on
 * `data-fdn-theme`. Left to itself FoundathyonProvider defaults to "system" and
 * *removes* that attribute, so picking "light" flipped the app's own tokens and
 * left every design-system token dark.
 *
 * Passing `theme` makes it controlled, and `storageKey={null}` stops it
 * persisting a second, competing preference: next-themes already owns that.
 */
export function DesignSystemProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <FoundathyonProvider
      accent={BRAND_ACCENT}
      theme={resolvedTheme === 'light' ? 'light' : 'dark'}
      onThemeChange={(next) => setTheme(next)}
      storageKey={null}
    >
      {children}
    </FoundathyonProvider>
  );
}
