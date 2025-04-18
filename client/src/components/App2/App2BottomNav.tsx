import React from "react";
import { Link, useLocation } from "wouter";
import { Home, Map, List, User, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

export default function App2BottomNav() {
  const [location] = useLocation();

  const navItems: NavItem[] = [
    {
      path: "/app2",
      label: "Home",
      icon: <Home size={20} />
    },
    {
      path: "/app2/map",
      label: "Kaart",
      icon: <Map size={20} />
    },
    {
      path: "/app2/list",
      label: "Lijst",
      icon: <List size={20} />
    },
    {
      path: "/app2/favorites",
      label: "Favorieten",
      icon: <Heart size={20} />
    },
    {
      path: "/app2/profile",
      label: "Profiel",
      icon: <User size={20} />
    }
  ];

  return (
    <nav className="bottom-nav">
      <div className="flex justify-around items-center">
        {navItems.map((item) => (
          <Link 
            key={item.path} 
            href={item.path}
          >
            <a className={cn(
              "flex flex-col items-center justify-center px-2 py-1 text-xs",
              location === item.path 
                ? "text-primary font-medium" 
                : "text-muted-foreground"
            )}>
              {item.icon}
              <span className="mt-1">{item.label}</span>
            </a>
          </Link>
        ))}
      </div>
    </nav>
  );
}