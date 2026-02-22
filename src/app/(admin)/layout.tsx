import { AdminProvider } from '@/context/admin-context';
import { AdminSidebar } from './admin-sidebar';
import { AdminSessionGuard } from '@/components/admin-session-guard';
import { OnboardingGuard } from '@/components/onboarding-guard';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminProvider>
      <AdminSessionGuard>
        <OnboardingGuard>
          <SidebarProvider collapsible="icon">
            <AdminSidebar />
            <SidebarInset>
              <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
              </header>
              <div className="flex-1 overflow-y-auto p-8 max-w-7xl mx-auto w-full font-sans">
                {children}
              </div>
            </SidebarInset>
          </SidebarProvider>
        </OnboardingGuard>
      </AdminSessionGuard>
    </AdminProvider>
  );
}
