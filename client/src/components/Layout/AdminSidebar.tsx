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
  Bell,
  Database,
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
  children?: NavItem[];
}

interface AdminSidebarProps {
  onClose?: () => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ onClose }) => {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [settingsOpen, setSettingsOpen] = useState(location.startsWith('/admin/settings') || location === '/admin/users');

  const { data: user } = useQuery<User>({
    queryKey: ['/api/auth/me'],
  });

  const mainNavItems: NavItem[] = [
    {
      href: '/admin',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      href: '/admin/events',
      label: 'Evenementen',
      icon: <Calendar className="w-5 h-5" />,
    },
    {
      href: '/admin/rss-feeds',
      label: 'RSS Feeds',
      icon: <Rss className="w-5 h-5" />,
    },
    {
      href: '/admin/tags',
      label: 'Tag Manager',
      icon: <Tags className="w-5 h-5" />,
    },
    {
      href: '/admin/venues',
      label: 'Venues',
      icon: <Building2 className="w-5 h-5" />,
    },
    {
      href: '/admin/promotions',
      label: 'Promoties',
      icon: <Megaphone className="w-5 h-5" />,
    },
    {
      href: '/admin/feedback',
      label: 'Feedback',
      icon: <MessageSquare className="w-5 h-5" />,
    },
    {
      href: '/admin/activity-logs',
      label: 'Activiteiten',
      icon: <ClipboardList className="w-5 h-5" />,
    },
  ];

  const settingsItems: NavItem[] = [
    {
      href: '/admin/users',
      label: 'Gebruikersbeheer',
      icon: <UserCog className="w-4 h-4" />,
    },
  ];

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', {
        method: 'POST',
      });
      
      toast({
        title: 'Uitgelogd',
        description: 'Je bent succesvol uitgelogd.',
      });
      
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: 'Uitloggen mislukt',
        description: 'Er is een fout opgetreden bij het uitloggen.',
        variant: 'destructive',
      });
    }
  };

  const isActive = (href: string) => {
    if (href === '/admin') {
      return location === '/admin';
    }
    return location.startsWith(href);
  };

  return (
    <aside className="w-64 h-screen bg-card border-r flex flex-col" data-testid="admin-sidebar">
      <div className="p-4 border-b">
        <Link href="/admin">
          <div className="flex items-center gap-3 cursor-pointer" data-testid="link-admin-home">
            <LogoIcon className="h-10 w-10" />
            <div>
              <h1 className="font-bold text-lg leading-tight">
                <span className="block">letsgo</span>
                <span className="block text-sm">radar admin</span>
              </h1>
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {mainNavItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <div
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors",
                isActive(item.href)
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-muted-foreground hover:text-foreground"
              )}
              data-testid={`nav-${item.label.toLowerCase()}`}
              onClick={onClose}
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          </Link>
        ))}

        <Separator className="my-4" />

        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
          <CollapsibleTrigger asChild>
            <div
              className={cn(
                "flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors",
                settingsOpen ? "bg-accent" : "hover:bg-accent",
                "text-muted-foreground hover:text-foreground"
              )}
              data-testid="nav-settings"
            >
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5" />
                <span>Instellingen</span>
              </div>
              {settingsOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-4 mt-1 space-y-1">
            {settingsItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors",
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
      </nav>

      <div className="p-4 border-t space-y-3">
        {user && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-accent/50">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
              {user.name?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name || user.username}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <Shield className="w-4 h-4 text-primary" title="Admin" />
          </div>
        )}
        
        <Button 
          variant="outline" 
          className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
          <span>Uitloggen</span>
        </Button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
