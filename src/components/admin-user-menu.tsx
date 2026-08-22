'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Bell, BookOpen, Languages, Loader2, LogOut, Moon, Settings, Sun } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSubmenu,
  DropdownMenuSubmenuTrigger,
  DropdownMenuTrigger,
  Tooltip,
} from '@foundathyon/community-ui';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { SUPPORTED_LOCALES } from '@/lib/i18n/types';
import { cn, BASE_PATH } from '@/lib/utils';

function buildHref(path: string) {
  return path === '/' ? `${BASE_PATH || '/'}` : `${BASE_PATH}${path}`.replace(/\/+/g, '/') || '/';
}

/**
 * Account menu for the shell header (§12: the topbar owns the avatar). Holds the
 * settings/notifications/docs destinations plus the theme and language pickers —
 * set-once preferences that don't earn permanent topbar real estate of their own.
 */
export function AdminUserMenu() {
  const router = useRouter();
  const { apiUrl, pendingOAuthLegacyMigration } = useAdmin();
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const [adminUser, setAdminUser] = useState<string | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch(apiUrl('/api/admin/session'), { credentials: 'include' });
        const data = await res.json();
        if (data.ok && data.user) setAdminUser(data.user);
      } catch {
        /* ignore */
      }
    };
    fetchSession();
  }, [apiUrl]);

  const handleLogout = async () => {
    if (logoutLoading) return;
    setLogoutLoading(true);
    try {
      await fetch(apiUrl('/api/admin/logout'), { method: 'POST', credentials: 'include' });
    } catch {
      /* continue */
    } finally {
      const loginPath = `${BASE_PATH}/login`.replace(/\/+/g, '/') || '/login';
      router.push(loginPath);
      router.refresh();
      setLogoutLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-150 hover:opacity-90 data-[popup-open]:opacity-90"
        aria-label={adminUser ?? t('sidebar.adminUser')}
      >
        <Tooltip
          content={t('sidebar.pendingOAuthMigrationAlert')}
          side="bottom"
          disabled={!pendingOAuthLegacyMigration}
        >
          <div className="relative flex size-8 items-center justify-center rounded-full bg-accent-solid text-accent-on-solid font-semibold text-xs">
            {(adminUser || 'A').charAt(0).toUpperCase()}
            {pendingOAuthLegacyMigration && (
              <span
                className="pointer-events-none absolute right-0 top-0 size-2.5 translate-x-px -translate-y-px rounded-full bg-orange-500 ring-2 ring-[var(--fdn-bg)]"
                aria-hidden
              />
            )}
          </div>
        </Tooltip>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56" align="end" side="bottom" sideOffset={6}>
        <div className="flex flex-col gap-1 px-2 py-1.5">
          <p className="text-sm font-medium text-text">{adminUser ?? t('sidebar.adminUser')}</p>
          <p className="text-xs text-muted-foreground">{adminUser ? `${adminUser}@admin` : ''}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={Settings} render={<Link href={buildHref('/settings')} />}>
          {t('sidebar.settings')}
        </DropdownMenuItem>
        <DropdownMenuItem icon={Bell} render={<Link href={buildHref('/notifications')} />}>
          <span className="flex items-center gap-2">
            <span className="flex-1 truncate">{t('sidebar.notifications')}</span>
            {pendingOAuthLegacyMigration ? (
              <span className="size-2 shrink-0 rounded-full bg-orange-500" aria-hidden />
            ) : null}
          </span>
        </DropdownMenuItem>
        <DropdownMenuSubmenu>
          <DropdownMenuSubmenuTrigger icon={Languages}>
            {t('common.language')}
          </DropdownMenuSubmenuTrigger>
          <DropdownMenuContent>
            {SUPPORTED_LOCALES.map(({ code, label }) => (
              <DropdownMenuItem
                key={code}
                onClick={() => setLocale(code)}
                className={locale === code ? 'bg-accent-bg' : ''}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenuSubmenu>
        <DropdownMenuSubmenu>
          <DropdownMenuSubmenuTrigger icon={(theme ?? 'dark') === 'dark' ? Moon : Sun}>
            {t('sidebar.theme')}
          </DropdownMenuSubmenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              icon={Sun}
              onClick={() => setTheme('light')}
              className={(theme ?? 'dark') === 'light' ? 'bg-accent-bg' : ''}
            >
              {t('sidebar.themeLight')}
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={Moon}
              onClick={() => setTheme('dark')}
              className={(theme ?? 'dark') === 'dark' ? 'bg-accent-bg' : ''}
            >
              {t('sidebar.themeDark')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuSubmenu>
        <DropdownMenuItem
          icon={BookOpen}
          render={<a href="https://accounts.authify.dev/" target="_blank" rel="noopener noreferrer" />}
        >
          {t('sidebar.docs')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          icon={logoutLoading ? Loader2 : LogOut}
          onClick={handleLogout}
          disabled={logoutLoading}
          className={cn(
            'text-muted-foreground data-[highlighted]:bg-danger-bg data-[highlighted]:text-danger',
            logoutLoading && '[&_svg]:animate-spin'
          )}
        >
          {logoutLoading ? t('sidebar.loggingOut') : t('sidebar.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
