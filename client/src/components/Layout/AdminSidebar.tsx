import { Link, useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  Calendar,
  ClipboardList,
  Settings,
  LogOut,
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
  Shield,
  UserCog,
  Rss,
  Tags,
  Megaphone,
  Building2,
  MessageSquare
} from 'lucide-react';
import { LogoIcon } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from '@/components/ui/separator';

interface User {
  id: number;
  username: string;
  name?: string;
  email: string;
  role: string;
  photoUrl?: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface AdminSidebarProps {
  onClose?: () => void;
  collapsed?: boolean;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ onClose, collapsed = false }) => {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [settingsOpen, setSettingsOpen] = useState(location.startsWith('/admin/settings') || location === '/admin/users');

  const { data: user } = useQuery<User>({
    queryKey: ['/api/auth/me'],
  });

  const mainNavItems: NavItem[] = [
    { href: '/admin', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5 shrink-0" /> },
    { href: '/admin/events', label: 'Evenementen', icon: <Calendar className="w-5 h-5 shrink-0" /> },
    { href: '/admin/rss-feeds', label: 'RSS Feeds', icon: <Rss className="w-5 h-5 shrink-0" /> },
    { href: '/admin/tags', label: 'Tag Manager', icon: <Tags className="w-5 h-5 shrink-0" /> },
    { href: '/admin/venues', label: 'Venues', icon: <Building2 className="w-5 h-5 shrink-0" /> },
    { href: '/admin/promotions', label: 'Promoties', icon: <Megaphone className="w-5 h-5 shrink-0" /> },
    { href: '/admin/feedback', label: 'Feedback', icon: <MessageSquare className="w-5 h-5 shrink-0" /> },
    { href: '/admin/activity-logs', label: 'Activiteiten', icon: <ClipboardList className="w-5 h-5 shrink-0" /> },
  ];

  const settingsItems: NavItem[] = [
    { href: '/admin/users', label: 'Gebruikersbeheer', icon: <UserCog className="w-4 h-4 shrink-0" /> },
  ];

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
      toast({ title: 'Uitgelogd', description: 'Je bent succesvol uitgelogd.' });
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      toast({ title: 'Uitloggen mislukt', description: 'Er is een fout opgetreden bij het uitloggen.', variant: 'destructive' });
    }
  };

  const isActive = (href: string) => {
    if (href === '/admin') return location === '/admin';
    return location.startsWith(href);
  };

  return (
    <aside
      className={cn(
        "h-screen bg-card border-r flex flex-col transition-all duration-200 overflow-hidden",
        collapsed ? "w-16" : "w-64"
      )}
      data-testid="admin-sidebar"
    >
      <div className={cn("border-b shrink-0", collapsed ? "p-3 flex justify-center" : "p-4")}>
        <Link href="/admin">
          <div
            className={cn("flex items-center cursor-pointer", collapsed ? "justify-center" : "gap-3")}
            data-testid="link-admin-home"
            onClick={onClose}
          >
            <LogoIcon className="h-9 w-9 shrink-0" />
            {!collapsed && (
              <div>
                <h1 className="font-bold text-lg leading-tight">
                  <span className="block">letsgo</span>
                  <span className="block text-sm">radar admin</span>
                </h1>
              </div>
            )}
          </div>
        </Link>
      </div>

      <nav className={cn("flex-1 overflow-y-auto space-y-1", collapsed ? "p-2" : "p-4")}>
        {mainNavItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <div
              className={cn(
                "flex items-center rounded-lg text-sm font-medium cursor-pointer transition-colors min-h-[44px]",
                collapsed ? "justify-center px-0 py-2" : "gap-3 px-3 py-2.5",
                isActive(item.href)
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-muted-foreground hover:text-foreground"
              )}
              data-testid={`nav-${item.label.toLowerCase()}`}
              onClick={onClose}
              title={collapsed ? item.label : undefined}
            >
              {item.icon}
              {!collapsed && <span>{item.label}</span>}
            </div>
          </Link>
        ))}

        <Separator className="my-2" />

        {collapsed ? (
          <>
            {settingsItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center justify-center px-0 py-2 rounded-lg text-sm cursor-pointer transition-colors min-h-[44px]",
                    isActive(item.href)
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent text-muted-foreground hover:text-foreground"
                  )}
                  onClick={onClose}
                  title={item.label}
                >
                  {item.icon}
                </div>
              </Link>
            ))}
          </>
        ) : (
          <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
            <CollapsibleTrigger asChild>
              <div
                className={cn(
                  "flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors min-h-[44px]",
                  settingsOpen ? "bg-accent" : "hover:bg-accent",
                  "text-muted-foreground hover:text-foreground"
                )}
                data-testid="nav-settings"
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 shrink-0" />
                  <span>Instellingen</span>
                </div>
                {settingsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-4 mt-1 space-y-1">
              {settingsItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors min-h-[44px]",
                      isActive(item.href)
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent text-muted-foreground hover:text-foreground"
                    )}
                    data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    onClick={onClose}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                </Link>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </nav>

      <div className={cn("border-t shrink-0 space-y-2", collapsed ? "p-2" : "p-4")}>
        {user && (
          collapsed ? (
            <div
              className="flex justify-center py-1"
              title={user.name || user.username}
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                {user.name?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || 'A'}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-accent/50">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium shrink-0">
                {user.name?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name || user.username}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              <Shield className="w-4 h-4 text-primary shrink-0" title="Admin" />
            </div>
          )
        )}

        <Button
          variant="outline"
          className={cn(
            "w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 min-h-[44px]",
            collapsed ? "justify-center px-0" : "justify-start"
          )}
          onClick={handleLogout}
          data-testid="button-logout"
          title={collapsed ? "Uitloggen" : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Uitloggen</span>}
        </Button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
