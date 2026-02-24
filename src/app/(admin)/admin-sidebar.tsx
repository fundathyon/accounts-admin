'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Settings,
  Shield,
  Webhook,
  Puzzle,
  Key,
  LogIn,
  LogOut,
  Loader2,
  ChevronsUpDown,
  Mail,
  User,
  BookOpen,
  Languages,
  Sun,
  Moon,
} from 'lucide-react';
import { cn, BASE_PATH } from '@/lib/utils';
import { useAdmin } from '@/context/admin-context';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useI18n } from '@/context/i18n-context';
import { SUPPORTED_LOCALES } from '@/lib/i18n/types';
import { useTheme } from 'next-themes';

const ADMIN_VERSION = '0.1.0';

function buildHref(path: string) {
  return path === '/' ? `${BASE_PATH || '/'}` : `${BASE_PATH}${path}`.replace(/\/+/g, '/') || '/';
}

const navItems = [
  { id: 'dashboard', path: '/', icon: LayoutDashboard, labelKey: 'sidebar.dashboard' },
  { id: 'users', path: '/users', icon: Users, labelKey: 'sidebar.users' },
  { id: 'roles_policies', path: '/roles-policies', icon: Shield, labelKey: 'sidebar.roles' },
  { id: 'webhooks', path: '/webhooks', icon: Webhook, labelKey: 'sidebar.webhooks' },
  { id: 'api_keys', path: '/api-keys', icon: Key, labelKey: 'sidebar.apiKeys' },
  { id: 'oauth_providers', path: '/oauth-providers', icon: LogIn, labelKey: 'sidebar.oauthProviders' },
  { id: 'behaviors', path: '/behaviors', icon: Puzzle, labelKey: 'sidebar.behaviors' },
  { id: 'email_templates', path: '/email-templates', icon: Mail, labelKey: 'sidebar.emailTemplates' },
  { id: 'settings', path: '/settings', icon: Settings, labelKey: 'sidebar.settings' },
];

interface AppInfo {
  id: string;
  name: string;
}

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { savedSecretKey, apiUrl } = useAdmin();
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const { isMobile } = useSidebar();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [app, setApp] = useState<AppInfo | null>(null);
  const [adminUser, setAdminUser] = useState<string | null>(null);

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

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const res = await fetch(apiUrl('/api/apps'));
        const data = await res.json();
        const apps = data.data ?? data;
        const list = Array.isArray(apps) ? apps : [];
        if (list.length > 0) {
          setApp({ id: list[0].id, name: list[0].name });
        }
      } catch {
        /* ignore */
      }
    };
    fetchApps();
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
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
                    A
                  </div>
                  <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[state=collapsed]/sidebar-wrapper:hidden">
                    <span className="truncate font-semibold">
                      {app?.name ?? 'Foundathyon Admin'}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {app ? t('sidebar.app') : t('sidebar.apiAccounts')}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 shrink-0 group-data-[state=collapsed]/sidebar-wrapper:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
                align="start"
                side={isMobile ? 'bottom' : 'right'}
                sideOffset={4}
              >
                {app && (
                  <div className="px-2 py-1.5 text-sm font-medium truncate text-muted-foreground">
                    {app.name}
                  </div>
                )}
                <DropdownMenuItem disabled className="text-muted-foreground text-xs">
                  API Accounts · Community
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('sidebar.nav')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const href = buildHref(item.path);
                const isUsersSection = item.id === 'users';
                const usersActive = isUsersSection && (pathname === '/users' || pathname?.startsWith('/users/'));
                const pathMatch = item.path === '/' ? (pathname === '/' || pathname === '') : (pathname === item.path || pathname?.startsWith(item.path + '/'));
                const active = pathMatch || usersActive;
                const needsKey = ['users', 'webhooks', 'behaviors', 'roles_policies', 'oauth_providers'].includes(item.id);

                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link href={href} className="flex items-center gap-3 overflow-hidden">
                        <item.icon className="size-4 shrink-0" />
                        <span className="truncate group-data-[state=collapsed]/sidebar-wrapper:hidden">
                          {t(item.labelKey)}
                        </span>
                        {needsKey && !savedSecretKey && (
                          <span className="ml-auto size-2 rounded-full bg-amber-400 shrink-0 group-data-[state=collapsed]/sidebar-wrapper:hidden" />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground font-semibold text-xs">
                    {(adminUser || 'A').charAt(0).toUpperCase()}
                  </div>
                  <div className="grid min-w-0 flex-1 text-left text-sm leading-tight truncate group-data-[state=collapsed]/sidebar-wrapper:hidden">
                    <span className="truncate font-medium">{adminUser ?? t('sidebar.adminUser')}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {adminUser ? `${adminUser}@admin` : ''}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 shrink-0 group-data-[state=collapsed]/sidebar-wrapper:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
                align="start"
                side={isMobile ? 'top' : 'right'}
                sideOffset={4}
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{adminUser ?? t('sidebar.adminUser')}</p>
                    <p className="text-xs text-muted-foreground">
                      {adminUser ? `${adminUser}@admin` : ''}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={buildHref('/settings')}>
                    <Settings className="mr-2 size-4" />
                    {t('sidebar.settings')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Languages className="mr-2 size-4" />
                    {t('common.language')}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {SUPPORTED_LOCALES.map(({ code, label }) => (
                      <DropdownMenuItem
                        key={code}
                        onClick={() => setLocale(code)}
                        className={locale === code ? 'bg-accent' : ''}
                      >
                        {label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    {(theme ?? 'dark') === 'dark' ? (
                      <Moon className="mr-2 size-4" />
                    ) : (
                      <Sun className="mr-2 size-4" />
                    )}
                    {t('sidebar.theme')}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      onClick={() => setTheme('light')}
                      className={(theme ?? 'dark') === 'light' ? 'bg-accent' : ''}
                    >
                      <Sun className="mr-2 size-4" />
                      {t('sidebar.themeLight')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setTheme('dark')}
                      className={(theme ?? 'dark') === 'dark' ? 'bg-accent' : ''}
                    >
                      <Moon className="mr-2 size-4" />
                      {t('sidebar.themeDark')}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem asChild>
                  <a href="https://accounts.authify.dev/" target="_blank" rel="noopener noreferrer" className="flex items-center">
                    <BookOpen className="mr-2 size-4" />
                    {t('sidebar.docs')}
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  disabled={logoutLoading}
                  className="text-muted-foreground focus:text-destructive"
                >
                  {logoutLoading ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <LogOut className="mr-2 size-4" />
                  )}
                  {logoutLoading ? t('sidebar.loggingOut') : t('sidebar.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="px-2 py-3 border-t border-sidebar-border group-data-[state=collapsed]/sidebar-wrapper:hidden">
          <p className="text-[10px] text-muted-foreground truncate" title={`v${ADMIN_VERSION} · ${t('sidebar.poweredBy')}`}>
            v{ADMIN_VERSION} · {t('sidebar.poweredBy')}
          </p>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
