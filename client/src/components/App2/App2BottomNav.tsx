import * as React from "react";
import { useLocation, Link } from "wouter";
import { Home, Calendar, Heart, User, Plus, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export function App2BottomNav() {
  const [location] = useLocation();
  
  // Function to check if a route is active
  const isActive = (route: string) => {
    if (route === '/app2' && location === '/app2') {
      return true;
    }
    return location.startsWith(route) && route !== '/app2';
  };
  
  // Navigation items with icons and labels
  const navItems = [
    { 
      href: "/app2", 
      icon: Home, 
      label: "Home",
      isActive: isActive("/app2")
    },
    { 
      href: "/app2/events", 
      icon: Calendar, 
      label: "Evenementen",
      isActive: isActive("/app2/events")
    },
    { 
      href: "/app2/create-event", 
      icon: Plus, 
      label: "Toevoegen",
      isPrimary: true,
      isActive: isActive("/app2/create-event")
    },
    { 
      href: "/app2/favorites", 
      icon: Heart, 
      label: "Favorieten",
      isActive: isActive("/app2/favorites")
    },
    { 
      href: "/app2/profile", 
      icon: User, 
      label: "Profiel",
      isActive: isActive("/app2/profile")
    },
  ];

  // Get web version path for switcher
  const getWebPath = () => {
    if (location === '/app2') return '/web';
    if (location.startsWith('/app2/event/')) {
      const id = location.split('/').pop();
      return `/web/event/${id}`;
    }
    // Replace /app2 with /web for other paths
    return location.replace('/app2', '/web');
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t z-50">
      <div className="flex items-center justify-between p-1 relative">
        {navItems.map((item, index) => (
          <Link key={index} href={item.href}>
            <a className="w-full">
              <div 
                className={cn(
                  "flex flex-col items-center justify-center py-1 px-2", 
                  item.isActive 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-foreground",
                  item.isPrimary && "relative"
                )}
              >
                {item.isPrimary ? (
                  <div className="absolute -top-5 bg-primary text-primary-foreground rounded-full p-2 shadow-lg">
                    <item.icon className="h-5 w-5" />
                  </div>
                ) : (
                  <item.icon className="h-5 w-5" />
                )}
                <span className={cn(
                  "text-xs mt-1", 
                  item.isPrimary && "mt-3",
                )}>
                  {item.label}
                </span>
              </div>
            </a>
          </Link>
        ))}
      </div>
      
      {/* Web version switcher */}
      <div className="absolute right-3 -top-10 bg-secondary rounded-full h-8 w-8 flex items-center justify-center">
        <Link href={getWebPath()}>
          <a className="text-secondary-foreground hover:text-primary-foreground">
            <ExternalLink className="h-4 w-4" />
          </a>
        </Link>
      </div>
    </div>
  );
}

export default App2BottomNav;