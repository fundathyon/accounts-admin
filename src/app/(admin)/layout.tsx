import { AdminProvider } from '@/context/admin-context';
import { AdminSidebar } from './admin-sidebar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminProvider>
      <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
        <AdminSidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <header className="h-20 border-b border-border flex items-center justify-between px-8 bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
            <div className="max-w-sm w-full relative">
              <input
                type="text"
                placeholder="Buscar..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </header>
          <div className="p-8 max-w-7xl mx-auto w-full space-y-0">
            {children}
          </div>
        </main>
      </div>
    </AdminProvider>
  );
}
