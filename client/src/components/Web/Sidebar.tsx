import * as React from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { MdHome, MdEvent, MdFavorite, MdAccountCircle, MdAdd } from "react-icons/md";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  const [location] = useLocation();

  const isActive = (path: string) => {
    return location === path;
  };

  const navItems = [
    { path: "/web", icon: <MdHome className="h-5 w-5" />, label: "Home" },
    { path: "/web/events", icon: <MdEvent className="h-5 w-5" />, label: "Mijn Evenementen" },
    { path: "/web/favorites", icon: <MdFavorite className="h-5 w-5" />, label: "Favorieten" },
    { path: "/web/profile", icon: <MdAccountCircle className="h-5 w-5" />, label: "Profiel" },
  ];

  return (
    <div className="w-64 h-screen bg-card border-r border-border flex flex-col">
      <div className="p-4">
        <h1 className="text-2xl font-bold">EventApp</h1>
      </div>
      
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map((item) => (
          <Link key={item.path} href={item.path}>
            <a className={cn(
              "flex items-center px-4 py-3 text-sm font-medium rounded-md group transition-colors",
              isActive(item.path)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}>
              {item.icon}
              <span className="ml-3">{item.label}</span>
            </a>
          </Link>
        ))}
      </nav>
      
      <div className="p-4">
        <Button asChild className="w-full flex gap-2 items-center">
          <Link href="/web/create-event">
            <MdAdd className="h-5 w-5" />
            <span>Nieuw Evenement</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default Sidebar;