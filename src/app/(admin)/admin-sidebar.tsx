'use client';

import { useState, useEffect } from 'react';
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
  ChevronsUpDown,
  Mail,
  Ticket,
  Palette,
  Image as ImageIcon,
  ScrollText,
  ListFilter,
} from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  FormField,
  Input,
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarSection,
  Tooltip,
  useSidebar,
} from '@foundathyon/community-ui';
import { cn, BASE_PATH } from '@/lib/utils';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const { savedSecretKey, apiUrl } = useAdmin();
  const { t } = useI18n();
  const { collapsed, setCollapsed } = useSidebar();
  const isMobile = useIsMobile();
  const [app, setApp] = useState<AppInfo | null>(null);

  // Entering mobile closes the panel, and so does navigating to another page;
  // the stored desktop preference is left alone.
  useEffect(() => {
    if (isMobile) setCollapsed(true);
  }, [isMobile, pathname, setCollapsed]);

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

  const sidebar = (
    <Sidebar>
      <SidebarHeader className={collapsed ? undefined : 'px-2'}>
        <DropdownMenu>
          <Tooltip content={t('tooltips.editApp')} side="right">
            <DropdownMenuTrigger
              className={cn(
                'flex h-12 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left',
                'transition-colors duration-150 hover:bg-surface-hover data-[popup-open]:bg-surface-hover',
                collapsed && 'w-auto justify-center px-0'
              )}
            >
              <div
                className={cn(
                  'flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg font-bold text-sm overflow-hidden',
                  !app?.image && 'bg-accent-solid text-accent-on-solid'
                )}
              >
                {app?.image ? (
                  <img src={app.image} alt={app.name} className="size-full object-cover" />
                ) : (
                  (app?.name || 'A').charAt(0).toUpperCase()
                )}
              </div>
              <div className={cn('grid min-w-0 flex-1 text-left text-sm leading-tight', collapsed && 'hidden')}>
                {/* Brand colours stay on the app's own `sidebar-primary`/`primary`
                    tokens: community-ui's `.text-accent` / `.bg-accent` are shadowed
                    by shadcn's neutral `--accent` because globals.css loads last. */}
                <span className="truncate font-semibold text-accent">
                  {app?.name ?? 'Accounts Admin'}
                </span>
                <span className="truncate text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                  {app ? t('sidebar.app') : t('sidebar.apiAccounts')}
                </span>
              </div>
              <ChevronsUpDown className={cn('ml-auto size-4 shrink-0 opacity-50', collapsed && 'hidden')} />
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent
            className="w-[var(--anchor-width)] min-w-56"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            {app && (
              <>
                <DropdownMenuGroup>
                  <DropdownMenuGroupLabel>{t('sidebar.app')}</DropdownMenuGroupLabel>
                  <DropdownMenuItem
                    className="px-3 py-2"
                    onClick={openUpdateModal}
                    disabled={!savedSecretKey}
                  >
                    <span className="flex items-center gap-2">
                      <Palette className="size-4 shrink-0 text-accent" />
                      <span className="font-medium">{t('sidebar.editApp')}</span>
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem disabled className="px-3 text-caption text-muted-foreground">
              API Accounts · Community
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
        <DialogContent size="sm">
          <form onSubmit={handleUpdateApp} className="flex min-w-0 flex-col gap-3">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-accent" />
                {t('sidebar.editApp')}
              </DialogTitle>
              <DialogDescription>
                Actualiza el branding visual de tu aplicación para el panel administrativo.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-6">
              <FormField label={t('sidebar.appName')}>
                <Input
                  value={updateForm.name}
                  onChange={(e) => setUpdateForm({ ...updateForm, name: e.target.value })}
                  placeholder="Mi Aplicación"
                  required
                />
              </FormField>
              <FormField
                label={t('sidebar.appImage')}
                description="Ingresa una URL directa a la imagen del logo (PNG, JPG, SVG)."
              >
                {/* Icon box and Input are both DS-sized to h-control-md (32px)
                    so their top and bottom edges align pixel-for-pixel. Using
                    `size-10` on the box (40px) against the Input's 32px height
                    was the reported misalignment. */}
                <div className="flex gap-2 items-center">
                  <div className={cn(
                    "h-control-md w-control-md shrink-0 rounded-md flex items-center justify-center overflow-hidden border border-border",
                    !updateForm.image && "bg-bg-subtle"
                  )}>
                    {updateForm.image ? (
                      <img src={updateForm.image} alt="Preview" className="size-full object-cover" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-text-muted" />
                    )}
                  </div>
                  <Input
                    value={updateForm.image}
                    onChange={(e) => setUpdateForm({ ...updateForm, image: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    wrapperClassName="flex-1"
                    className="font-mono text-xs"
                  />
                </div>
              </FormField>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsUpdateModalOpen(false)}
                disabled={isUpdating}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={isUpdating}
                leading={<Palette className="w-4 h-4" />}
              >
                {isUpdating ? t('sidebar.updatingApp') : t('sidebar.updateApp')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <SidebarSection label={t('sidebar.nav')}>
          {navItems.map((item) => {
            const href = buildHref(item.path);
            const isUsersSection = item.id === 'users';
            const usersActive = isUsersSection && (pathname === '/users' || pathname?.startsWith('/users/'));
            const pathMatch = item.path === '/' ? (pathname === '/' || pathname === '') : (pathname === item.path || pathname?.startsWith(item.path + '/'));
            const active = pathMatch || usersActive;
            const needsKey = ['users', 'webhooks', 'behaviors', 'roles_policies', 'oauth_providers', 'email_access'].includes(item.id);
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
                        <span className="ml-auto size-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
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
          className={cn('border-b border-border pb-2', collapsed && 'hidden')}
        >
          <SidebarItem
            icon={ScrollText}
            label={t('sidebar.releaseNotesLink')}
            render={(props) => <Link href={buildHref('/release-notes')} {...props} />}
          />
        </SidebarSection>

        <div className={cn('px-2 py-3 border-t border-border', collapsed && 'hidden')}>
          <p className="text-[10px] text-muted-foreground truncate" title={`v${ADMIN_VERSION} · ${t('sidebar.poweredBy')}`}>
            v{ADMIN_VERSION} · {t('sidebar.poweredBy')}
          </p>
        </div>
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
