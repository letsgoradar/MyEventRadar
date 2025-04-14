import * as React from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Home, CalendarDays, Heart, User, PlusCircle, Settings } from "lucide-react";

export function App2BottomNav() {
  const [location] = useLocation();

  const isActiveRoute = (path: string) => {
    return location === path || location.startsWith(path + "/");
  };

  const navItems = [
    {
      href: "/app2",
      icon: Home,
      label: "Home",
    },
    {
      href: "/app2/events",
      icon: CalendarDays,
      label: "Evenementen",
    },
    {
      href: "/app2/create-event",
      icon: PlusCircle,
      label: "Toevoegen",
      isPrimary: true
    },
    {
      href: "/app2/favorites",
      icon: Heart,
      label: "Favorieten",
    },
    {
      href: "/app2/profile",
      icon: User,
      label: "Profiel",
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full bg-background border-t z-20">
      <div className="flex justify-around">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <a className={cn(
              "flex flex-col items-center py-2 px-1",
              "transition-colors",
              isActiveRoute(item.href) ? "text-primary" : "text-muted-foreground",
            )}>
              <div className={cn(
                "flex items-center justify-center rounded-full mb-1",
                item.isPrimary && "bg-primary text-primary-foreground p-2"
              )}>
                <item.icon className={cn(
                  item.isPrimary ? "h-5 w-5" : "h-5 w-5",
                )} />
              </div>
              <span className="text-xs">{item.label}</span>
            </a>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default App2BottomNav;