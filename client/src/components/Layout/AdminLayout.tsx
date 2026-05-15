import { useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { LogoIcon } from '@/components/ui/logo';
import AdminSidebar from './AdminSidebar';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="h-screen flex bg-background">
      <div className="hidden md:flex shrink-0">
        <AdminSidebar />
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 [&>button]:hidden">
          <AdminSidebar onClose={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex md:hidden items-center gap-3 px-4 h-14 border-b bg-card shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            aria-label="Menu openen"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <LogoIcon className="h-7 w-7" />
          <span className="font-semibold text-sm">letsgo radar admin</span>
        </div>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
