import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, PanelLeft } from 'lucide-react';
import AdminSidebar from './AdminSidebar';

const PAGE_TITLES: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/events': 'Evenementen',
  '/admin/rss-feeds': 'RSS Feeds',
  '/admin/tags': 'Tag Manager',
  '/admin/venues': 'Venues',
  '/admin/promotions': 'Promoties & Advertenties',
  '/admin/feedback': 'Beta Feedback',
  '/admin/activity-logs': 'Activiteiten',
  '/admin/users': 'Gebruikersbeheer',
  '/admin/settings': 'Instellingen',
  '/admin/settings/categories': 'Categorieën',
  '/admin/settings/cities': 'Steden',
};

function getPageTitle(location: string): string {
  if (PAGE_TITLES[location]) return PAGE_TITLES[location];
  if (location.startsWith('/admin/venues/')) return 'Venue Detail';
  if (location.startsWith('/admin/settings')) return 'Instellingen';
  return 'Admin';
}

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const update = () => setCollapsed(window.innerWidth < 1024);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const pageTitle = getPageTitle(location);

  return (
    <div className="h-screen flex bg-background">
      <div className="hidden md:flex shrink-0">
        <AdminSidebar collapsed={collapsed} />
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 [&>button]:hidden">
          <AdminSidebar onClose={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center gap-2 px-4 h-14 border-b bg-card shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0"
            onClick={() => setMobileOpen(true)}
            aria-label="Menu openen"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="hidden md:flex shrink-0"
            onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? 'Zijbalk uitvouwen' : 'Zijbalk inklappen'}
          >
            <PanelLeft className="h-5 w-5" />
          </Button>

          <span className="font-semibold text-sm truncate">{pageTitle}</span>
        </div>

        <main className="flex-1 overflow-auto [&_td_button]:min-h-[44px] [&_td_a]:min-h-[44px] [&_td_.flex]:min-h-[44px]">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
