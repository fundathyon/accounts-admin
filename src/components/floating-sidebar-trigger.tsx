'use client';

import { SidebarTrigger, useSidebar } from '@foundathyon/community-ui';
import { useIsMobile } from '@/hooks/use-mobile';

export function FloatingSidebarTrigger() {
  const { collapsed } = useSidebar();
  const isMobile = useIsMobile();

  // Below 768px the sidebar is an overlay drawer, so it takes no inline width
  // and the trigger stays pinned to the viewport edge. Above it, the trigger
  // tracks community-ui's shell widths (--fdn-sidebar-width 13rem ·
  // --fdn-sidebar-collapsed 3rem).
  const left = isMobile
    ? '10px'
    : collapsed
      ? 'calc(var(--fdn-sidebar-collapsed, 3rem) + 10px)'
      : 'calc(var(--fdn-sidebar-width, 13rem) + 10px)';

  return (
    <div
      className="fixed z-40 transition-[left] duration-200 ease-linear"
      style={{
        left,
        top: '1.5rem',
        transform: 'translateY(-50%)',
      }}
    >
      <SidebarTrigger className="size-8 rounded-lg border border-border bg-bg p-1.5 shadow-md" />
    </div>
  );
}
