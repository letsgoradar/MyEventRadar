import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import {
  LayoutDashboard,
  Megaphone,
  Star,
  CreditCard,
  ArrowLeft,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RadarLogoWithText } from '@/components/RadarLogo';

const navItems = [
  { href: '/advertiser/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/advertiser/ads', label: 'Advertenties', icon: Megaphone },
  { href: '/advertiser/promotions', label: 'Event Promoties', icon: Star },
  { href: '/advertiser/billing', label: 'Saldo & Facturatie', icon: CreditCard },
];

export default function AdvertiserSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  return (
    <aside className="w-64 border-r bg-card flex flex-col h-screen sticky top-0">
      <div className="p-4 border-b">
        <Link href="/">
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
            <Link key={item.href} href={item.href}>
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
        <Link href="/">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
            Terug naar site
          </div>
        </Link>
      </div>
    </aside>
  );
}
