import * as React from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  HomeIcon,
  Map,
  Search,
  Bookmark,
  PlusCircle,
  User,
  UserCheck,
  ExternalLink
} from "lucide-react";

// Helper om de huidige web URL voor dezelfde pagina te krijgen
const getWebPath = () => {
  const location = window.location.pathname;
  if (location.startsWith("/app/event/")) {
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

export function AppBottomNav() {
  const [location] = useLocation();
  
  // Check of deze pagina ook in de webversie beschikbaar is
  const webVersionEnabled = React.useMemo(() => {
    return !location.includes("/app/search");
  }, [location]);
  
  React.useEffect(() => {
    console.log("Web version enabled:", webVersionEnabled);
  }, [webVersionEnabled]);

  // Navigatie items configuratie
  const navItems = React.useMemo(() => [
    {
      label: "Map",
      href: "/app",
      icon: Map,
      isActive: location === "/app" || location === "/app/",
    },
    {
      label: "Aanmaken",
      href: "/app/create-event",
      icon: PlusCircle,
      isActive: location.includes("/app/create-event"),
      isPrimary: true,
    },
    {
      label: "Mijn Events",
      href: "/app/my-events",
      icon: Bookmark,
      isActive: location.includes("/app/saved") || location.includes("/app/favorites") || location.includes("/app/my-events"),
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
    </div>
  );
}

export default AppBottomNav;