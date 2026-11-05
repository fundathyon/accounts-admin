'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, BookOpen, ChevronDown, Languages, Loader2, LogOut, Settings } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSubmenu,
  DropdownMenuSubmenuTrigger,
  DropdownMenuTrigger,
  Tooltip,
  useSidebar,
} from '@foundathyon/community-ui';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { SUPPORTED_LOCALES } from '@/lib/i18n/types';
import { cn, BASE_PATH } from '@/lib/utils';

function buildHref(path: string) {
  return path === '/' ? `${BASE_PATH || '/'}` : `${BASE_PATH}${path}`.replace(/\/+/g, '/') || '/';
}

/**
 * Account card at the foot of the sidebar, as in the Foundathyon admin. Holds the
 * settings/notifications/docs destinations plus the theme and language pickers —
 * set-once preferences that don't earn permanent topbar real estate of their own.
 */
export function AdminUserMenu() {
  const router = useRouter();
  const { apiUrl, pendingOAuthLegacyMigration } = useAdmin();
  const { t, locale, setLocale } = useI18n();
  const { collapsed } = useSidebar();
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
        className={cn(
          'mx-2 mt-1 flex min-w-0 items-center gap-2.5 rounded-lg border border-border bg-surface p-2 text-left transition-colors duration-150 hover:bg-surface-hover data-[popup-open]:bg-surface-hover',
          collapsed && 'mx-auto border-0 bg-transparent p-0'
        )}
        aria-label={adminUser ?? t('sidebar.adminUser')}
      >
        <Tooltip
          content={t('sidebar.pendingOAuthMigrationAlert')}
          side="right"
          disabled={!pendingOAuthLegacyMigration}
        >
          <div className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-solid text-xs font-semibold text-accent-on-solid">
            {(adminUser || 'A').charAt(0).toUpperCase()}
            {pendingOAuthLegacyMigration && (
              <span
                className="pointer-events-none absolute right-0 top-0 size-2.5 translate-x-px -translate-y-px rounded-full bg-warning-solid ring-2 ring-[var(--fdn-bg)]"
                aria-hidden
              />
            )}
          </div>
        </Tooltip>
        {!collapsed && (
          <>
            <span className="grid min-w-0 flex-1">
              <span className="truncate text-body-sm font-medium text-text">
                {adminUser ?? t('sidebar.adminUser')}
              </span>
              <span className="truncate text-caption text-text-muted">
                {adminUser ? `${adminUser}@admin` : ''}
              </span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-text-muted" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56" align="start" side="top" sideOffset={6}>
        <div className="flex flex-col gap-1 px-2 py-1.5">
          <p className="text-body font-medium text-text">{adminUser ?? t('sidebar.adminUser')}</p>
          <p className="text-xs text-text-muted">{adminUser ? `${adminUser}@admin` : ''}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={Settings} render={<Link href={buildHref('/settings')} />}>
          {t('sidebar.settings')}
        </DropdownMenuItem>
        <DropdownMenuItem icon={Bell} render={<Link href={buildHref('/notifications')} />}>
          <span className="flex items-center gap-2">
            <span className="flex-1 truncate">{t('sidebar.notifications')}</span>
            {pendingOAuthLegacyMigration ? (
              <span className="size-2 shrink-0 rounded-full bg-warning-solid" aria-hidden />
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
            'text-text-muted data-[highlighted]:bg-danger-bg data-[highlighted]:text-danger',
            logoutLoading && '[&_svg]:animate-spin'
          )}
        >
          {logoutLoading ? t('sidebar.loggingOut') : t('sidebar.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
