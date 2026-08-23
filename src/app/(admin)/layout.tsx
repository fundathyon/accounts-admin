import { AdminProvider } from '@/context/admin-context';
import { OAuthLegacyMigrationNotifier } from '@/components/oauth-legacy-migration-notifier';
import { AdminSidebar } from './admin-sidebar';
import { AdminTopbar } from './admin-topbar';
import { AdminSessionGuard } from '@/components/admin-session-guard';
import { OnboardingGuard } from '@/components/onboarding-guard';
import { AdminCommandPaletteProvider } from '@/components/admin-command-palette';
import { SidebarProvider } from '@foundathyon/community-ui';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminProvider>
      <OAuthLegacyMigrationNotifier />
      <AdminSessionGuard>
        <OnboardingGuard>
          {/* community-ui persists the collapse preference in localStorage
              (shadcn used a cookie that nothing ever read back). */}
          <SidebarProvider storageKey="authify_admin_sidebar_collapsed">
            <AdminCommandPaletteProvider>
              {/* Replaces shadcn's SidebarProvider wrapper + SidebarInset: the shell
                  is exactly one viewport tall so <Sidebar> (h-full) fills it and the
                  content column owns the scroll. */}
              <div className="flex h-svh w-full">
                <AdminSidebar />
                <main className="relative flex w-full min-w-0 flex-1 flex-col bg-bg">
                  <AdminTopbar />
                  {/* The Topbar owns the sidebar trigger now, so the content no
                      longer needs extra top padding to clear a floating button. */}
                  <div className="flex-1 overflow-y-auto p-8 max-w-7xl mx-auto w-full font-sans">
                    {children}
                  </div>
                </main>
              </div>
            </AdminCommandPaletteProvider>
          </SidebarProvider>
        </OnboardingGuard>
      </AdminSessionGuard>
    </AdminProvider>
  );
}
