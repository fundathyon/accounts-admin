import { AdminProvider } from '@/context/admin-context';
import { AdminSidebar } from './admin-sidebar';
import { AdminSessionGuard } from '@/components/admin-session-guard';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminProvider>
      <AdminSessionGuard>
      <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
        <AdminSidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <div className="p-8 max-w-7xl mx-auto w-full space-y-0">
            {children}
          </div>
        </main>
      </div>
      </AdminSessionGuard>
    </AdminProvider>
  );
}
