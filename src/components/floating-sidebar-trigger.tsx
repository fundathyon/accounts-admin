'use client';

import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';

export function FloatingSidebarTrigger() {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const left = isCollapsed
    ? 'calc(var(--sidebar-width-icon, 3rem) + 10px)'
    : 'calc(var(--sidebar-width, 16rem) + 10px)';

  return (
    <div
      className="fixed z-40 transition-[left] duration-200 ease-linear"
      style={{
        left,
        top: '1.5rem',
        transform: 'translateY(-50%)',
      }}
    >
      <SidebarTrigger className="size-8 rounded-lg border bg-background p-1.5 shadow-md hover:bg-accent [&>svg]:size-4" />
    </div>
  );
}
