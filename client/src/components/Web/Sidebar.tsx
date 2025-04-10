import * as React from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { MdHome, MdEvent, MdFavorite, MdAccountCircle, MdAdd, MdChevronRight, MdChevronLeft } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function Sidebar() {
  const [location] = useLocation();
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  // Sidebar wordt standaard uitgeklapt bij klikken op pijltje
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

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
    <div 
      className={cn(
        "h-screen bg-card border-r border-border flex flex-col transition-all duration-300 z-20 relative",
        isExpanded ? "w-64" : "w-16"
      )}
    >
      <div className={cn(
        "flex flex-col items-center transition-all duration-300",
        isExpanded ? "p-4" : "p-3"
      )}>
        {isExpanded ? (
          <>
            <div className="flex flex-col items-center mb-2">
              <img 
                src="/images/event-logo.svg" 
                alt="EventApp Logo" 
                className="w-10 h-10" 
              />
              <h1 className="text-xl font-bold mt-2">EventApp</h1>
            </div>
            <Button variant="ghost" size="sm" className="p-1 w-full" onClick={toggleExpanded}>
              <MdChevronLeft className="h-5 w-5" />
            </Button>
          </>
        ) : (
          <>
            <div className="w-full flex justify-center mb-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <img 
                      src="/images/event-logo.svg" 
                      alt="EventApp Logo" 
                      className="w-10 h-10" 
                    />
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>EventApp</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Button variant="ghost" size="sm" className="p-1 w-full" onClick={toggleExpanded}>
              <MdChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}
      </div>
      
      <nav className={cn(
        "flex-1 py-4 space-y-1",
        isExpanded ? "px-2" : "px-1"
      )}>
        <TooltipProvider>
          {navItems.map((item) => (
            <div key={item.path} className="relative">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href={item.path}>
                    <div 
                      className={cn(
                        "flex items-center text-sm font-medium rounded-md group transition-colors",
                        isExpanded ? "px-4 py-3" : "px-2 py-3 justify-center",
                        isActive(item.path)
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                    >
                      {item.icon}
                      {isExpanded && <span className="ml-3">{item.label}</span>}
                    </div>
                  </Link>
                </TooltipTrigger>
                {!isExpanded && (
                  <TooltipContent side="right">{item.label}</TooltipContent>
                )}
              </Tooltip>
            </div>
          ))}
        </TooltipProvider>
      </nav>
      
      <div className={cn(
        "transition-all duration-300",
        isExpanded ? "p-4" : "p-2"
      )}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                asChild 
                className={cn(
                  "flex gap-2 items-center",
                  isExpanded ? "w-full" : "w-full p-2 justify-center"
                )}
              >
                <Link href="/web/create-event">
                  <MdAdd className="h-5 w-5" />
                  {isExpanded && <span>Nieuw Evenement</span>}
                </Link>
              </Button>
            </TooltipTrigger>
            {!isExpanded && (
              <TooltipContent side="right">Nieuw Evenement</TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

export default Sidebar;