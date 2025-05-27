import React, { useState } from 'react';
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
  Menu,
  X,
  ChevronDown,
  Activity
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger,
  SheetClose
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
}

const AdminNav: React.FC = () => {
  const [location] = useLocation();
  const { toast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  interface User {
    id: number;
    username: string;
    email: string;
    role: string;
  }

  // Fetch current user
  const { data: user } = useQuery<User>({
    queryKey: ['/api/auth/me'],
  });
  
  const navItems: NavItem[] = [
    {
      href: '/admin',
      label: 'Dashboard',
      icon: <Activity className="w-5 h-5" />,
      active: location === '/admin',
    },
    {
      href: '/admin/events',
      label: 'Evenementen',
      icon: <Calendar className="w-5 h-5" />,
      active: location === '/admin/events',
    },
    {
      href: '/admin/users',
      label: 'Gebruikers',
      icon: <Users className="w-5 h-5" />,
      active: location === '/admin/users',
    },
    {
      href: '/admin/activity-logs',
      label: 'Activiteit',
      icon: <ClipboardList className="w-5 h-5" />,
      active: location === '/admin/activity-logs',
    },
  ];
  
  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', {
        method: 'POST',
      });
      
      // Log the logout activity
      if (user?.id) {
        await apiRequest('/api/admin/log-activity', {
          method: 'POST',
          data: JSON.stringify({
            userId: user.id,
            activityType: 'logout',
            details: { 
              section: 'admin_panel'
            }
          })
        });
      }
      
      toast({
        title: 'Uitgelogd',
        description: 'Je bent succesvol uitgelogd.',
      });
      
      // Redirect to login page
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      
      toast({
        title: 'Uitloggen mislukt',
        description: 'Er is een fout opgetreden bij het uitloggen. Probeer het opnieuw.',
        variant: 'destructive',
      });
    }
  };
  
  const MobileNavItem: React.FC<NavItem & { onClose?: () => void }> = ({ 
    href, 
    label, 
    icon, 
    active, 
    onClose 
  }) => (
    <SheetClose asChild>
      <Link href={href}>
        <div
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium cursor-pointer",
            active
              ? "bg-primary text-primary-foreground"
              : "hover:bg-accent"
          )}
          onClick={onClose}
        >
          {icon}
          {label}
        </div>
      </Link>
    </SheetClose>
  );
  
  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="container flex items-center justify-between h-16 px-4 md:px-6">
        {/* Logo and title */}
        <div className="flex items-center gap-2">
          <Link href="/admin">
            <div className="flex items-center gap-2 cursor-pointer">
              <Logo className="h-8 w-8" />
              <span className="font-semibold text-lg hidden md:inline-block">
                Admin Dashboard
              </span>
            </div>
          </Link>
        </div>
        
        {/* Desktop navigation */}
        <nav className="hidden md:flex items-center space-x-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-2 cursor-pointer",
                  item.active
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>
        
        {/* User menu and mobile menu */}
        <div className="flex items-center gap-2">
          {/* User dropdown */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 hidden md:flex">
                  <span>{user.username}</span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span>Instellingen</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="flex items-center gap-2 text-red-500"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Uitloggen</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[350px]">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between pb-4 border-b">
                  <div className="flex items-center gap-2">
                    <Logo className="h-6 w-6" />
                    <span className="font-semibold">Admin Menu</span>
                  </div>
                  <SheetClose asChild>
                    <Button size="icon" variant="ghost">
                      <X className="h-5 w-5" />
                      <span className="sr-only">Close</span>
                    </Button>
                  </SheetClose>
                </div>
                
                {/* User info (mobile) */}
                {user && (
                  <div className="py-4 border-b">
                    <div className="text-sm font-medium">Ingelogd als:</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        {user.username?.[0]?.toUpperCase() || 'A'}
                      </div>
                      <div>
                        <div className="font-medium">{user.username}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Mobile nav links */}
                <nav className="flex flex-col gap-1 py-4">
                  {navItems.map((item) => (
                    <MobileNavItem key={item.href} {...item} />
                  ))}
                </nav>
                
                {/* Logout button (mobile) */}
                <div className="mt-auto pt-4 border-t">
                  <SheetClose asChild>
                    <Button 
                      variant="destructive" 
                      className="w-full flex items-center justify-center gap-2"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Uitloggen</span>
                    </Button>
                  </SheetClose>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default AdminNav;