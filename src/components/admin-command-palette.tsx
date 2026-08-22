'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Key,
  KeyRound,
  LayoutDashboard,
  ListFilter,
  LogIn,
  Mail,
  Puzzle,
  ScrollText,
  Settings,
  Shield,
  Ticket,
  Users,
  Webhook,
  type LucideIcon,
} from 'lucide-react';
import { CommandPalette, Icon, useCommandPalette, type CommandGroup } from '@foundathyon/community-ui';
import { useI18n } from '@/context/i18n-context';
import { BASE_PATH } from '@/lib/utils';

function buildHref(path: string) {
  return path === '/' ? `${BASE_PATH || '/'}` : `${BASE_PATH}${path}`.replace(/\/+/g, '/') || '/';
}

/** Every destination in the shell, mirroring the sidebar's own nav. */
const DESTINATIONS: { id: string; path: string; icon: LucideIcon; labelKey: string }[] = [
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
  { id: 'release_notes', path: '/release-notes', icon: ScrollText, labelKey: 'sidebar.releaseNotesSection' },
];

/**
 * Actions that deep-link into a page's own create flow. Each page opens its
 * dialog from a `?new=1` query param, so the palette only has to navigate.
 */
const ACTIONS: { id: string; path: string; icon: LucideIcon; labelKey: string }[] = [
  { id: 'new_webhook', path: '/webhooks?new=1', icon: Webhook, labelKey: 'webhooks.createWebhook' },
  { id: 'new_api_key', path: '/api-keys?new=1', icon: KeyRound, labelKey: 'apiKeys.generateKeys' },
  { id: 'new_role', path: '/roles-policies?new=1', icon: Shield, labelKey: 'roles.createRole' },
];

interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const Ctx = createContext<CommandPaletteContextValue | null>(null);

/** Lets the topbar's search button drive the same palette instance. */
export function useAdminCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdminCommandPalette must be used within AdminCommandPaletteProvider');
  return ctx;
}

export function AdminCommandPaletteProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { t } = useI18n();
  // Owns the ⌘K / Ctrl+K binding.
  const { open, setOpen } = useCommandPalette();

  const groups = useMemo<CommandGroup[]>(() => {
    const go = (path: string) => () => router.push(buildHref(path));
    return [
      {
        heading: t('commandPalette.goTo'),
        items: DESTINATIONS.map(({ id, path, icon, labelKey }) => ({
          id,
          label: t(labelKey),
          icon: <Icon icon={icon} size={16} />,
          onSelect: go(path),
        })),
      },
      {
        heading: t('commandPalette.actions'),
        items: ACTIONS.map(({ id, path, icon, labelKey }) => ({
          id,
          label: t(labelKey),
          icon: <Icon icon={icon} size={16} />,
          onSelect: go(path),
        })),
      },
    ];
  }, [router, t]);

  const value = useMemo(() => ({ open, setOpen }), [open, setOpen]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        items={groups}
        placeholder={t('commandPalette.placeholder')}
      />
    </Ctx.Provider>
  );
}
