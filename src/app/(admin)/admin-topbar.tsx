'use client';

import Link from 'next/link';
import { Bell, Moon, Search, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Icon, Kbd, SidebarTrigger, Tooltip, Topbar } from '@foundathyon/community-ui';
import { AdminUserMenu } from '@/components/admin-user-menu';
import { useAdminCommandPalette } from '@/components/admin-command-palette';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { BASE_PATH } from '@/lib/utils';

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

/**
 * Shell header (§12). Replaces the floating sidebar trigger, which is why the
 * content column no longer needs its extra top padding to clear it.
 */
export function AdminTopbar() {
  const { t } = useI18n();
  const { pendingOAuthLegacyMigration } = useAdmin();
  const { setOpen } = useAdminCommandPalette();

  return (
    <Topbar
      leading={<SidebarTrigger label={t('commandPalette.search')} />}
      center={
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-7 w-full max-w-80 items-center gap-2 rounded-md border border-border bg-subtle px-2.5 text-caption text-muted-foreground transition-colors duration-150 hover:bg-surface-hover"
        >
          <Icon icon={Search} size={14} />
          <span className="flex-1 truncate text-left">{t('commandPalette.placeholder')}</span>
          <Kbd>{t('commandPalette.shortcut')}</Kbd>
        </button>
      }
      trailing={
        <>
          <ThemeToggle
            label={(dark) => (dark ? t('sidebar.themeLight') : t('sidebar.themeDark'))}
          />
          <Tooltip content={t('sidebar.notifications')}>
            <Link
              href={buildHref('/notifications')}
              aria-label={t('sidebar.notifications')}
              className="relative flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-surface-hover hover:text-text"
            >
              <Icon icon={Bell} size={16} />
              {pendingOAuthLegacyMigration && (
                <span
                  className="pointer-events-none absolute right-1.5 top-1.5 size-2 rounded-full bg-orange-500 ring-2 ring-[var(--fdn-bg)]"
                  aria-hidden
                />
              )}
            </Link>
          </Tooltip>
          <AdminUserMenu />
        </>
      }
    />
  );
}
