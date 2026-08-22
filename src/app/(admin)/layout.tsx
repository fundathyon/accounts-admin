import { AdminProvider } from '@/context/admin-context';
import { OAuthLegacyMigrationNotifier } from '@/components/oauth-legacy-migration-notifier';
import { AdminSidebar } from './admin-sidebar';
import { AdminSessionGuard } from '@/components/admin-session-guard';
import { OnboardingGuard } from '@/components/onboarding-guard';
import { FloatingSidebarTrigger } from '@/components/floating-sidebar-trigger';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

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
          <SidebarProvider>
            <AdminSidebar />
            <FloatingSidebarTrigger />
            <SidebarInset>
              <div className="flex-1 overflow-y-auto p-8 pt-14 max-w-7xl mx-auto w-full font-sans">
                {children}
              </div>
            </SidebarInset>
          </SidebarProvider>
        </OnboardingGuard>
      </AdminSessionGuard>
    </AdminProvider>
  );
}
