'use client';

import { Languages } from 'lucide-react';
import { useI18n } from '@/context/i18n-context';
import { SUPPORTED_LOCALES } from '@/lib/i18n/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuButton } from '@/components/ui/sidebar';

export function LanguageSelector() {
  const { locale, setLocale, t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton className="text-muted-foreground hover:text-foreground w-full justify-start">
          <Languages className="size-4 shrink-0" />
          <span>{SUPPORTED_LOCALES.find((l) => l.code === locale)?.label ?? locale}</span>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="min-w-40">
        {SUPPORTED_LOCALES.map(({ code, label }) => (
          <DropdownMenuItem
            key={code}
            onClick={() => setLocale(code)}
            className={locale === code ? 'bg-accent' : ''}
          >
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
