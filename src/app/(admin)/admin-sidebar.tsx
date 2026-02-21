'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Layers,
  Users,
  Settings,
  Shield,
  Webhook,
  Puzzle,
  Key,
} from 'lucide-react';
import { cn, BASE_PATH } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/context/admin-context';

function buildHref(path: string) {
  return path === '/' ? `${BASE_PATH || '/'}` : `${BASE_PATH}${path}`.replace(/\/+/g, '/') || '/';
}

const navItems = [
  { id: 'dashboard', path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'apps', path: '/apps', icon: Layers, label: 'Aplicaciones' },
  { id: 'users', path: '/users', icon: Users, label: 'Usuarios' },
  { id: 'roles_policies', path: '/roles-policies', icon: Shield, label: 'Roles y Políticas' },
  { id: 'webhooks', path: '/webhooks', icon: Webhook, label: 'Webhooks' },
  { id: 'api_keys', path: '/api-keys', icon: Key, label: 'API Keys' },
  { id: 'behaviors', path: '/behaviors', icon: Puzzle, label: 'Behaviors' },
  { id: 'settings', path: '/settings', icon: Settings, label: 'Configuración' },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { savedSecretKey } = useAdmin();

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col z-20 shrink-0">
      <div className="p-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground text-sm">
            A
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight">Authify Admin</span>
            <div className="mt-1">
              <Badge variant="secondary" className="text-[10px] font-medium px-1.5 py-0">
                API Accounts · Community
              </Badge>
            </div>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const href = buildHref(item.path);
          const isUsersSection = item.id === 'users';
          const usersActive = isUsersSection && (pathname === '/users' || pathname?.startsWith('/users/'));
          const pathMatch = item.path === '/' ? (pathname === '/' || pathname === '') : (pathname === item.path || pathname?.startsWith(item.path + '/'));
          const active = pathMatch || usersActive;

          const needsKey = ['users', 'webhooks', 'behaviors', 'roles_policies', 'api_keys'].includes(item.id);

          return (
            <Link key={item.id} href={href}>
              <div
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl font-normal cursor-pointer transition-colors hover:bg-muted/50',
                  active && 'bg-primary/10 text-primary font-semibold'
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
                {needsKey && !savedSecretKey && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-amber-400" />
                )}
              </div>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
