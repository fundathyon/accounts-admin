'use client';

import Link from 'next/link';
import { Bell, Moon, PanelLeftClose, PanelLeftOpen, Search, Settings, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Icon, Kbd, SidebarTrigger, Tooltip, useSidebar } from '@foundathyon/community-ui';
import { AdminAppSwitcher } from '@/components/admin-app-switcher';
import { IconButton, buttonVariants } from '@/components/fdn/button';
import { useAdminCommandPalette } from '@/components/admin-command-palette';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { BASE_PATH, cn } from '@/lib/utils';

function buildHref(path: string) {
  return path === '/' ? `${BASE_PATH || '/'}` : `${BASE_PATH}${path}`.replace(/\/+/g, '/') || '/';
}

/**
 * One-click theme toggle. Reads `resolvedTheme` (never `theme` — the latter
 * can be 'system' before hydration, and we'd flash the wrong icon) and flips
 * to the other value. The icon is the DESTINATION (Sun when we're in dark
 * about to switch to light, Moon when we're in light about to switch to
 * dark) so the affordance matches the user's next click, not the current
 * state — the same convention used by GitHub, Vercel and Linear.
 */
function ThemeToggle({ label }: { label: (dark: boolean) => string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';
  const nextLabel = label(isDark);
  return (
    <Tooltip content={nextLabel}>
      <button
        type="button"
        aria-label={nextLabel}
        aria-pressed={isDark}
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        className="relative flex size-8 items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-surface-hover hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <Icon icon={isDark ? Sun : Moon} size={16} />
      </button>
    </Tooltip>
  );
}

/** Same placement as the Foundathyon admin: on the sidebar's top right edge. */
export function SidebarToggleButton() {
  const { t } = useI18n();
  const { collapsed, setCollapsed } = useSidebar();
  return (
    <div className="absolute right-0 top-2 z-20 translate-x-full">
      <IconButton
        icon={collapsed ? PanelLeftOpen : PanelLeftClose}
        label={t('commandPalette.search')}
        variant="ghost"
        onClick={() => setCollapsed(!collapsed)}
        className="ml-2 rounded-md border bg-bg shadow-sm hover:bg-surface-hover"
      />
    </div>
  );
}

/**
 * Shell header, the Foundathyon admin's layout: three grid columns so the search
 * stays centred on the bar whatever the width of the app chip.
 */
export function AdminTopbar() {
  const { t } = useI18n();
  const { pendingOAuthLegacyMigration } = useAdmin();
  const { setOpen } = useAdminCommandPalette();

  return (
    <header className="sticky top-0 z-40 grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 border-b border-border bg-bg px-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <div className="flex min-w-0 items-center gap-2 justify-self-start">
        <SidebarTrigger className="md:hidden" label={t('commandPalette.search')} />
        <AdminAppSwitcher />
      </div>

      <div className="hidden w-[min(24rem,28vw)] sm:block">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-8 w-full items-center gap-2 rounded-md border border-border bg-bg-subtle px-2.5 text-body-sm text-text-muted transition-colors duration-150 hover:bg-surface-hover"
        >
          <Icon icon={Search} size={14} />
          <span className="flex-1 truncate text-left">{t('commandPalette.placeholder')}</span>
          <Kbd>{t('commandPalette.shortcut')}</Kbd>
        </button>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-1 justify-self-end">
        <a
          href="https://accounts.authify.dev/"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'hidden lg:inline-flex')}
        >
          {t('sidebar.docs')}
        </a>
        <ThemeToggle
          label={(dark) => (dark ? t('sidebar.themeLight') : t('sidebar.themeDark'))}
        />
        <Tooltip content={t('sidebar.notifications')}>
          <Link
            href={buildHref('/notifications')}
            aria-label={t('sidebar.notifications')}
            className="relative flex size-8 items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-surface-hover hover:text-text"
          >
            <Icon icon={Bell} size={16} />
            {pendingOAuthLegacyMigration && (
              <span
                className="pointer-events-none absolute right-1.5 top-1.5 size-2 rounded-full bg-warning-solid ring-2 ring-[var(--fdn-bg)]"
                aria-hidden
              />
            )}
          </Link>
        </Tooltip>
        <Tooltip content={t('sidebar.settings')}>
          <Link
            href={buildHref('/settings')}
            aria-label={t('sidebar.settings')}
            className="relative flex size-8 items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-surface-hover hover:text-text"
          >
            <Icon icon={Settings} size={16} />
          </Link>
        </Tooltip>
      </div>
    </header>
  );
}
