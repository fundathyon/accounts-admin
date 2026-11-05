'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Settings,
  Shield,
  Webhook,
  Puzzle,
  Key,
  LogIn,
  Mail,
  Ticket,
  ScrollText,
  ListFilter,
  AppWindow,
  FileJson,
  Fingerprint,
  Gauge,
  History,
  Link2,
  Lock,
  LockKeyhole,
  MapPin,
  Plug,
  type LucideIcon,
} from 'lucide-react';
import {
  Sidebar,
  SidebarFooter,
  SidebarItem,
  SidebarSection,
  Tooltip,
  useSidebar,
} from '@foundathyon/community-ui';
import { cn, BASE_PATH } from '@/lib/utils';
import { useAdmin } from '@/context/admin-context';
import { useEdition } from '@/context/edition-context';
import { useI18n } from '@/context/i18n-context';
import { useIsMobile } from '@/hooks/use-mobile';
import { AdminUserMenu } from '@/components/admin-user-menu';

const ADMIN_VERSION = '0.2.0';

// Section labels at the Foundathyon admin's size, not the library's overline.
const SECTION_LABEL = '[&>span:first-child]:text-body-sm [&>span:first-child]:font-semibold';

function buildHref(path: string) {
  return path === '/' ? `${BASE_PATH || '/'}` : `${BASE_PATH}${path}`.replace(/\/+/g, '/') || '/';
}

// `proOnly` items render only when GET /health reports the Pro edition; with
// Community (or an unknown edition) the nav is exactly the list without them.
const navItems: { id: string; path: string; icon: LucideIcon; labelKey: string; proOnly?: boolean }[] = [
  { id: 'dashboard', path: '/', icon: LayoutDashboard, labelKey: 'sidebar.dashboard' },
  { id: 'users', path: '/users', icon: Users, labelKey: 'sidebar.users' },
  { id: 'user_metadata', path: '/user-metadata', icon: FileJson, labelKey: 'sidebar.userMetadata' },
  { id: 'roles_policies', path: '/roles-policies', icon: Shield, labelKey: 'sidebar.roles' },
  { id: 'policies', path: '/policies', icon: Lock, labelKey: 'sidebar.policies' },
  { id: 'webhooks', path: '/webhooks', icon: Webhook, labelKey: 'sidebar.webhooks' },
  { id: 'api_keys', path: '/api-keys', icon: Key, labelKey: 'sidebar.apiKeys' },
  { id: 'oauth_providers', path: '/oauth-providers', icon: LogIn, labelKey: 'sidebar.oauthProviders' },
  { id: 'mcp_connect', path: '/mcp-connect', icon: Plug, labelKey: 'sidebar.mcpConnect' },
  { id: 'behaviors', path: '/behaviors', icon: Puzzle, labelKey: 'sidebar.behaviors' },
  { id: 'email_templates', path: '/email-templates', icon: Mail, labelKey: 'sidebar.emailTemplates' },
  { id: 'email_access', path: '/email-access', icon: ListFilter, labelKey: 'sidebar.emailAccess' },
  { id: 'embedded_auth', path: '/embedded-auth', icon: AppWindow, labelKey: 'sidebar.embeddedAuth', proOnly: true },
  { id: 'mfa', path: '/mfa', icon: Fingerprint, labelKey: 'sidebar.mfa' },
  { id: 'session_security', path: '/session-security', icon: LockKeyhole, labelKey: 'sidebar.sessionSecurity' },
  { id: 'security_limits', path: '/security-limits', icon: Gauge, labelKey: 'sidebar.securityLimits' },
  { id: 'geo_access', path: '/geo-access', icon: MapPin, labelKey: 'sidebar.geoAccess', proOnly: true },
  { id: 'access_log', path: '/access-log', icon: History, labelKey: 'sidebar.accessLog' },
  { id: 'identity_linking', path: '/identity-linking', icon: Link2, labelKey: 'sidebar.identityLinking' },
  { id: 'tokens', path: '/tokens', icon: Ticket, labelKey: 'sidebar.tokens' },
  { id: 'settings', path: '/settings', icon: Settings, labelKey: 'sidebar.settings' },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { savedSecretKey } = useAdmin();
  const { t } = useI18n();
  const { isPro, name: editionName } = useEdition();
  const { collapsed, setCollapsed } = useSidebar();
  const isMobile = useIsMobile();

  // Entering mobile closes the panel, and so does navigating to another page;
  // the stored desktop preference is left alone.
  useEffect(() => {
    if (isMobile) setCollapsed(true);
  }, [isMobile, pathname, setCollapsed]);

  const sidebar = (
    <Sidebar>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <SidebarSection
          label={editionName ? t('sidebar.edition', { edition: editionName }) : t('sidebar.apiAccounts')}
          className={SECTION_LABEL}
        >
          {navItems.filter((item) => !item.proOnly || isPro).map((item) => {
            const href = buildHref(item.path);
            const isUsersSection = item.id === 'users';
            const usersActive = isUsersSection && (pathname === '/users' || pathname?.startsWith('/users/'));
            const pathMatch = item.path === '/' ? (pathname === '/' || pathname === '') : (pathname === item.path || pathname?.startsWith(item.path + '/'));
            const active = pathMatch || usersActive;
            const needsKey = ['users', 'user_metadata', 'webhooks', 'behaviors', 'roles_policies', 'policies', 'oauth_providers', 'mcp_connect', 'email_access', 'embedded_auth', 'mfa', 'session_security', 'security_limits', 'geo_access', 'access_log', 'identity_linking'].includes(item.id);
            // Descriptive hint — distinct from the label, so it is kept. When the
            // sidebar collapses SidebarItem renders the label tooltip itself, and
            // two tooltips must not stack on one trigger.
            const description = t(`tooltips.${item.id.replace('_', '')}`);

            return (
              <SidebarItem
                key={item.id}
                icon={item.icon}
                label={t(item.labelKey)}
                current={!!active}
                render={(props) => {
                  const link = (
                    <Link href={href} {...props}>
                      {props.children}
                      {needsKey && !savedSecretKey && !collapsed && (
                        <span className="ml-auto size-2 rounded-full bg-warning-solid shrink-0 animate-pulse" />
                      )}
                    </Link>
                  );
                  return collapsed ? (
                    link
                  ) : (
                    <Tooltip content={description} side="right">
                      {link}
                    </Tooltip>
                  );
                }}
              />
            );
          })}
        </SidebarSection>
      </div>

      <SidebarFooter>
        <SidebarSection
          label={t('sidebar.releaseNotesSection')}
          className={cn(SECTION_LABEL, collapsed && 'hidden')}
        >
          <SidebarItem
            icon={ScrollText}
            label={t('sidebar.releaseNotesLink')}
            render={(props) => <Link href={buildHref('/release-notes')} {...props} />}
          />
        </SidebarSection>

        <div className={cn('px-4 pb-1', collapsed && 'hidden')}>
          <p className="text-[10px] text-text-muted truncate" title={`v${ADMIN_VERSION} · ${t('sidebar.poweredBy')}`}>
            v{ADMIN_VERSION} · {t('sidebar.poweredBy')}
          </p>
        </div>
        <AdminUserMenu />
      </SidebarFooter>
    </Sidebar>
  );

  // community-ui's Sidebar has no mobile variant — it is always an inline
  // column, and its Drawer turns into a bottom sheet below 640px (its side
  // classes are all `sm:`-prefixed), which is wrong for navigation. Below
  // 768px shadcn rendered an off-canvas panel, so recreate that directly.
  // The provider's collapsed flag doubles as "panel closed", which keeps
  // FloatingSidebarTrigger working unchanged.
  if (isMobile) {
    return (
      <>
        {!collapsed && (
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setCollapsed(true)}
            aria-hidden="true"
          />
        )}
        {/* The slide is an inline style on purpose: `-translate-x-full` was
            silently overridden to `translate: 0%` by another stylesheet's
            same-name utility, so the panel never left the screen. Inline
            styles sit outside that shared namespace. */}
        <div
          className="fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out"
          style={{
            transform: collapsed ? 'translateX(-100%)' : 'translateX(0)',
            pointerEvents: collapsed ? 'none' : undefined,
          }}
        >
          {sidebar}
        </div>
      </>
    );
  }

  return sidebar;
}
