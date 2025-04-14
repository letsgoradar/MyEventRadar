import * as React from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  HomeIcon,
  Map,
  Search,
  Heart,
  PlusCircle,
  User,
  ExternalLink
} from "lucide-react";

// Helper om de huidige web URL voor dezelfde pagina te krijgen
const getWebPath = () => {
  const location = window.location.pathname;
  if (location.startsWith("/app2/event/")) {
    const eventId = location.split("/").pop();
    return `/web/event/${eventId}`;
  } else if (location.includes("/create-event")) {
    return "/web/create-event";
  } else if (location.includes("/favorites")) {
    return "/web/favorites";
  } else if (location.includes("/profile")) {
    return "/web/profile";
  } else {
    return "/web";
  }
};

export function App2BottomNav() {
  const [location] = useLocation();
  
  // Check of deze pagina ook in de webversie beschikbaar is
  const webVersionEnabled = React.useMemo(() => {
    return !location.includes("/app2/search");
  }, [location]);
  
  React.useEffect(() => {
    console.log("Web version enabled:", webVersionEnabled);
  }, [webVersionEnabled]);

  // Navigatie items configuratie
  const navItems = React.useMemo(() => [
    {
      label: "Evenementen",
      href: "/app2",
      icon: HomeIcon,
      isActive: location === "/app2" || location === "/app2/",
    },
    {
      label: "Zoeken",
      href: "/app2/search",
      icon: Search,
      isActive: location.includes("/app2/search"),
    },
    {
      label: "Aanmaken",
      href: "/app2/create-event",
      icon: PlusCircle,
      isActive: location.includes("/app2/create-event"),
      isPrimary: true,
    },
    {
      label: "Favorieten",
      href: "/app2/favorites",
      icon: Heart,
      isActive: location.includes("/app2/favorites"),
    },
    {
      label: "Profiel",
      href: "/app2/profile",
      icon: User,
      isActive: location.includes("/app2/profile"),
    },
  ], [location]);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t z-50">
      <div className="flex items-center justify-between p-1 relative">
        {navItems.map((item, index) => (
          <Link key={index} href={item.href} className="w-full">
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
          </Link>
        ))}
      </div>
      
      {/* Web version switcher */}
      <div className="absolute right-3 -top-10 bg-secondary rounded-full h-8 w-8 flex items-center justify-center">
        <Link href={getWebPath()} className="text-secondary-foreground hover:text-primary-foreground">
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export default App2BottomNav;