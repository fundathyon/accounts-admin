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
  Ticket,
  Pencil,
  Palette,
  Image as ImageIcon,
  Bell,
  ScrollText,
  ListFilter,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const ADMIN_VERSION = '0.2.0';

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
  { id: 'email_access', path: '/email-access', icon: ListFilter, labelKey: 'sidebar.emailAccess' },
  { id: 'tokens', path: '/tokens', icon: Ticket, labelKey: 'sidebar.tokens' },
  { id: 'settings', path: '/settings', icon: Settings, labelKey: 'sidebar.settings' },
];

interface AppInfo {
  id: string;
  name: string;
  image?: string;
}

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { savedSecretKey, apiUrl, pendingOAuthLegacyMigration } = useAdmin();
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
          setApp({ id: list[0].id, name: list[0].name, image: list[0].image });
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

  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateForm, setUpdateForm] = useState({ name: '', image: '' });
  const [isUpdating, setIsUpdating] = useState(false);
  const { showNotification } = useAdmin();

  const handleUpdateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!savedSecretKey || !app) return;
    setIsUpdating(true);
    try {
      const res = await fetch(apiUrl('/api/apps'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-API-Key': savedSecretKey,
        },
        body: JSON.stringify(updateForm),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(t('sidebar.appUpdated'), 'success');
        setApp({ ...app, name: updateForm.name, image: updateForm.image });
        setIsUpdateModalOpen(false);
      } else {
        showNotification(data.error?.message || t('sidebar.appUpdateError'), 'error');
      }
    } catch {
      showNotification(t('sidebar.appUpdateError'), 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const openUpdateModal = () => {
    if (!app) return;
    setUpdateForm({ name: app.name, image: app.image || '' });
    setIsUpdateModalOpen(true);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      size="lg"
                      className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    >
                      <div className={cn(
                        "flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg font-bold text-sm overflow-hidden",
                        !app?.image && "bg-sidebar-primary text-sidebar-primary-foreground"
                      )}>
                        {app?.image ? (
                          <img src={app.image} alt={app.name} className="size-full object-cover" />
                        ) : (
                          (app?.name || 'A').charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[state=collapsed]/sidebar-wrapper:hidden">
                        <span className="truncate font-semibold text-sidebar-primary">
                          {app?.name ?? 'Foundathyon Admin'}
                        </span>
                        <span className="truncate text-[10px] text-muted-foreground/80 uppercase tracking-wider font-bold">
                          {app ? t('sidebar.app') : t('sidebar.apiAccounts')}
                        </span>
                      </div>
                      <ChevronsUpDown className="ml-auto size-4 shrink-0 group-data-[state=collapsed]/sidebar-wrapper:hidden opacity-50" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right" align="center">
                  {t('tooltips.editApp')}
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
                align="start"
                side={isMobile ? 'bottom' : 'right'}
                sideOffset={4}
              >
                {app && (
                  <>
                    <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-3 py-2">
                      {t('sidebar.app')}
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      className="px-3 py-2 cursor-pointer"
                      onClick={openUpdateModal}
                      disabled={!savedSecretKey}
                    >
                      <Palette className="mr-2 size-4 text-primary" />
                      <span className="font-medium">{t('sidebar.editApp')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem disabled className="text-muted-foreground text-xs px-3">
                  API Accounts · Community
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleUpdateApp}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-primary" />
                {t('sidebar.editApp')}
              </DialogTitle>
              <DialogDescription>
                Actualiza el branding visual de tu aplicación para el panel administrativo.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-6">
              <div className="grid gap-2">
                <Label htmlFor="app-name">{t('sidebar.appName')}</Label>
                <Input
                  id="app-name"
                  value={updateForm.name}
                  onChange={(e) => setUpdateForm({ ...updateForm, name: e.target.value })}
                  placeholder="Mi Aplicación"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="app-image">{t('sidebar.appImage')}</Label>
                <div className="flex gap-3 items-start">
                  <div className={cn(
                    "size-10 shrink-0 rounded-lg flex items-center justify-center overflow-hidden border",
                    !updateForm.image && "bg-muted"
                  )}>
                    {updateForm.image ? (
                      <img src={updateForm.image} alt="Preview" className="size-full object-cover" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-muted-foreground/50" />
                    )}
                  </div>
                  <Input
                    id="app-image"
                    value={updateForm.image}
                    onChange={(e) => setUpdateForm({ ...updateForm, image: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    className="flex-1 font-mono text-xs"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Ingresa una URL directa a la imagen del logo (PNG, JPG, SVG).
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsUpdateModalOpen(false)}
                disabled={isUpdating}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isUpdating} className="gap-2">
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Palette className="w-4 h-4" />}
                {isUpdating ? t('sidebar.updatingApp') : t('sidebar.updateApp')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                const needsKey = ['users', 'webhooks', 'behaviors', 'roles_policies', 'oauth_providers', 'email_access'].includes(item.id);

                return (
                  <SidebarMenuItem key={item.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton asChild isActive={active}>
                          <Link href={href} className="flex items-center gap-3 overflow-hidden text-sm">
                            <item.icon className="size-4 shrink-0 transition-transform group-hover:scale-110" />
                            <span className="truncate group-data-[state=collapsed]/sidebar-wrapper:hidden">
                              {t(item.labelKey)}
                            </span>
                            {needsKey && !savedSecretKey && (
                              <span className="ml-auto size-2 rounded-full bg-amber-400 shrink-0 group-data-[state=collapsed]/sidebar-wrapper:hidden animate-pulse" />
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right" align="center" sideOffset={10} className="font-medium">
                        {t(`tooltips.${item.id.replace('_', '')}`)}
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 pb-3 border-b border-sidebar-border group-data-[state=collapsed]/sidebar-wrapper:hidden">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('sidebar.releaseNotesSection')}
          </p>
          <SidebarMenu>
            <SidebarMenuItem>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton asChild className="h-9">
                    <Link
                      href={buildHref('/release-notes')}
                      className="flex items-center gap-2 overflow-hidden"
                    >
                      <ScrollText className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">{t('sidebar.releaseNotesLink')}</span>
                    </Link>
                  </SidebarMenuButton>
                </TooltipTrigger>
                <TooltipContent side="right" align="center" sideOffset={10} className="font-medium">
                  {t('sidebar.releaseNotesLink')}
                </TooltipContent>
              </Tooltip>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          'relative flex shrink-0 aspect-square size-8 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground font-semibold text-xs',
                          pendingOAuthLegacyMigration && 'cursor-help'
                        )}
                      >
                        {(adminUser || 'A').charAt(0).toUpperCase()}
                        {pendingOAuthLegacyMigration && (
                          <span
                            className="pointer-events-none absolute right-0 top-0 size-2.5 translate-x-px -translate-y-px rounded-full bg-orange-500 ring-2 ring-sidebar"
                            aria-hidden
                          />
                        )}
                      </div>
                    </TooltipTrigger>
                    {pendingOAuthLegacyMigration && (
                      <TooltipContent side="right" align="center" className="max-w-[260px] text-xs leading-snug">
                        {t('sidebar.pendingOAuthMigrationAlert')}
                      </TooltipContent>
                    )}
                  </Tooltip>
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
                <DropdownMenuItem asChild>
                  <Link
                    href={buildHref('/notifications')}
                    className="relative flex w-full cursor-pointer items-center"
                  >
                    <Bell className="mr-2 size-4 shrink-0" />
                    <span className="flex-1">{t('sidebar.notifications')}</span>
                    {pendingOAuthLegacyMigration ? (
                      <span
                        className="ml-1 size-2 shrink-0 rounded-full bg-orange-500 ring-2 ring-popover"
                        aria-hidden
                      />
                    ) : null}
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
