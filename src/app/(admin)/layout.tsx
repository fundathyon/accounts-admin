import { AdminProvider } from '@/context/admin-context';
import { EditionProvider } from '@/context/edition-context';
import { OAuthLegacyMigrationNotifier } from '@/components/oauth-legacy-migration-notifier';
import { AdminSidebar } from './admin-sidebar';
import { AdminTopbar, SidebarToggleButton } from './admin-topbar';
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
      {/* Asks GET /health which edition runs, for Pro-only screens. Renders its
          children right away and stays "Community" until the backend says Pro. */}
      <EditionProvider>
        <OAuthLegacyMigrationNotifier />
        <AdminSessionGuard>
          <OnboardingGuard>
            {/* community-ui persists the collapse preference in localStorage
                (shadcn used a cookie that nothing ever read back). */}
            <SidebarProvider storageKey="authify_admin_sidebar_collapsed">
              <AdminCommandPaletteProvider>
                {/* Same shell as the Foundathyon admin: the header spans the
                    window and the sidebar and content sit below it. The content
                    column owns the scroll. */}
                <div className="flex h-svh w-full flex-col">
                  <AdminTopbar />
                  <div className="relative flex min-h-0 flex-1">
                    <div className="relative">
                      <AdminSidebar />
                      {/* Below md the sidebar is off-canvas and the header owns the trigger. */}
                      <div className="hidden md:block">
                        <SidebarToggleButton />
                      </div>
                    </div>
                    <main className="min-w-0 flex-1 overflow-y-auto bg-bg font-sans md:p-6">
                      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6 md:pb-0">{children}</div>
                    </main>
                  </div>
                </div>
              </AdminCommandPaletteProvider>
            </SidebarProvider>
          </OnboardingGuard>
        </AdminSessionGuard>
      </EditionProvider>
    </AdminProvider>
  );
}
