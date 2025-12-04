import * as React from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { MdHome, MdEvent, MdBookmark, MdAccountCircle, MdAdd, MdChevronRight, MdChevronLeft, MdLogin, MdLogout } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Sidebar() {
  const [location] = useLocation();
  const [isExpanded, setIsExpanded] = React.useState(false);
  const { user, logoutMutation } = useAuth();
  
  // Sidebar wordt standaard uitgeklapt bij klikken op pijltje
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const isActive = (path: string) => {
    return location === path;
  };

  const navItems = [
    { path: "/web", icon: <MdHome className="h-5 w-5" />, label: "Home" },
    { path: "/web/my-events", icon: <MdEvent className="h-5 w-5" />, label: "Mijn Events" },
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
                src="/images/letsgo-radar-logo.png" 
                alt="letsgo radar" 
                className="w-12 h-12 object-contain" 
              />
              <h1 className="text-lg font-bold mt-2 text-center leading-tight">
                <span className="block">letsgo</span>
                <span className="block">radar</span>
              </h1>
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
                      src="/images/letsgo-radar-logo.png" 
                      alt="letsgo radar" 
                      className="w-10 h-10 object-contain" 
                    />
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>letsgo radar</p>
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
      
      {/* Login Status Indicator */}
      <div className={cn(
        "border-t border-border transition-all duration-300",
        isExpanded ? "p-4" : "p-2"
      )}>
        <TooltipProvider>
          {user ? (
            <div className={cn(
              "flex items-center gap-3",
              isExpanded ? "" : "justify-center"
            )}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/web/profile">
                    <Avatar className="h-9 w-9 cursor-pointer border-2 border-primary/30 hover:border-primary transition-colors">
                      {user.photoUrl ? (
                        <AvatarImage src={user.photoUrl} alt={user.username || 'Profiel'} />
                      ) : (
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {user.username ? user.username.charAt(0).toUpperCase() : <MdAccountCircle className="h-5 w-5" />}
                        </AvatarFallback>
                      )}
                    </Avatar>
                  </Link>
                </TooltipTrigger>
                {!isExpanded && (
                  <TooltipContent side="right">
                    <p>{user.username || user.email}</p>
                    <p className="text-xs text-muted-foreground">Ingelogd</p>
                  </TooltipContent>
                )}
              </Tooltip>
              {isExpanded && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.username || 'Gebruiker'}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              )}
              {isExpanded && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => logoutMutation.mutate()}
                      className="p-2"
                    >
                      <MdLogout className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Uitloggen</TooltipContent>
                </Tooltip>
              )}
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  asChild 
                  variant="outline"
                  className={cn(
                    "flex gap-2 items-center",
                    isExpanded ? "w-full" : "w-full p-2 justify-center"
                  )}
                >
                  <Link href="/web/login">
                    <MdLogin className="h-5 w-5" />
                    {isExpanded && <span>Inloggen</span>}
                  </Link>
                </Button>
              </TooltipTrigger>
              {!isExpanded && (
                <TooltipContent side="right">Inloggen</TooltipContent>
              )}
            </Tooltip>
          )}
        </TooltipProvider>
      </div>
    </div>
  );
}

export default Sidebar;