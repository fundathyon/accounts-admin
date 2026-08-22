'use client';

import Link from 'next/link';
import { Bell, Search } from 'lucide-react';
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
          className="flex h-7 w-full max-w-80 items-center gap-2 rounded-md border border-border bg-subtle px-2.5 text-caption text-muted transition-colors duration-150 hover:bg-surface-hover"
        >
          <Icon icon={Search} size={14} />
          <span className="flex-1 truncate text-left">{t('commandPalette.placeholder')}</span>
          <Kbd>{t('commandPalette.shortcut')}</Kbd>
        </button>
      }
      trailing={
        <>
          <Tooltip content={t('sidebar.notifications')}>
            <Link
              href={buildHref('/notifications')}
              aria-label={t('sidebar.notifications')}
              className="relative flex size-8 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-surface-hover hover:text-text"
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
