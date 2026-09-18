import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import {
  LayoutDashboard,
  Megaphone,
  CreditCard,
  ArrowLeft,
  Building2,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RadarLogoWithText } from '@/components/RadarLogo';

const navItems = [
  { href: '/advertiser/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/advertiser/campaigns', label: 'Campagnes', icon: Megaphone },
  { href: '/advertiser/billing', label: 'Saldo & Facturatie', icon: CreditCard },
];

function SidebarContent({ location, user, onNavigate }: { location: string; user: any; onNavigate?: () => void }) {
  return (
    <>
      <div className="p-4 border-b">
        <Link href="/" onClick={onNavigate}>
          <RadarLogoWithText height={24} />
        </Link>
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span>Adverteerder</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.href || location.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} onClick={onNavigate}>
              <div
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t space-y-1">
        {user && (
          <div className="px-3 py-2 text-sm text-muted-foreground truncate">
            {user.name || user.username}
          </div>
        )}
        <Link href="/" onClick={onNavigate}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
            Terug naar site
          </div>
        </Link>
      </div>
    </>
  );
}

export default function AdvertiserSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b z-40 flex items-center justify-between px-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/">
          <RadarLogoWithText height={20} />
        </Link>
        <Link href="/">
          <div className="p-2 -mr-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </div>
        </Link>
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-card flex flex-col shadow-xl animate-in slide-in-from-left duration-200">
            <div className="absolute top-3 right-3">
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent
              location={location}
              user={user}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <aside className="hidden lg:flex w-64 border-r bg-card flex-col h-screen sticky top-0">
        <SidebarContent location={location} user={user} />
      </aside>
    </>
  );
}
