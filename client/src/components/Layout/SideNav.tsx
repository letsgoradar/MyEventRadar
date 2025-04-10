import React, { useState } from 'react';
import { Home, PlusCircle, Calendar, Heart, User, Menu, X } from 'lucide-react';
import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface SideNavProps {
  className?: string;
}

export default function SideNav({ className }: SideNavProps) {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const NavItems = () => (
    <>
      <Link href="/">
        <Button
          variant={location === '/' ? "default" : "ghost"}
          className={cn(
            "w-full justify-start mb-2",
            location === '/' && "bg-primary text-primary-foreground"
          )}
          onClick={() => setIsOpen(false)}
        >
          <Home className="mr-2 h-5 w-5" />
          <span>Home</span>
        </Button>
      </Link>

      <Link href="/events">
        <Button
          variant={location === '/events' ? "default" : "ghost"}
          className={cn(
            "w-full justify-start mb-2",
            location === '/events' && "bg-primary text-primary-foreground"
          )}
          onClick={() => setIsOpen(false)}
        >
          <Calendar className="mr-2 h-5 w-5" />
          <span>Events</span>
        </Button>
      </Link>

      <Link href="/create-event">
        <Button
          variant="default"
          className="w-full justify-start mb-2 bg-[#0097FB] hover:bg-[#0087e1]"
          onClick={() => setIsOpen(false)}
        >
          <PlusCircle className="mr-2 h-5 w-5" />
          <span>Aanmaken</span>
        </Button>
      </Link>

      <Link href="/favorites">
        <Button
          variant={location === '/favorites' ? "default" : "ghost"}
          className={cn(
            "w-full justify-start mb-2",
            location === '/favorites' && "bg-primary text-primary-foreground"
          )}
          onClick={() => setIsOpen(false)}
        >
          <Heart className="mr-2 h-5 w-5" />
          <span>Favorieten</span>
        </Button>
      </Link>

      <Link href="/profile">
        <Button
          variant={location === '/profile' ? "default" : "ghost"}
          className={cn(
            "w-full justify-start mb-2",
            location === '/profile' && "bg-primary text-primary-foreground"
          )}
          onClick={() => setIsOpen(false)}
        >
          <User className="mr-2 h-5 w-5" />
          <span>Profiel</span>
        </Button>
      </Link>
    </>
  );

  // Desktop sidenav
  return (
    <>
      {/* Desktop sidebar - always visible on larger screens */}
      <div className={cn("hidden md:flex flex-col w-64 p-4 border-r h-full", className)}>
        <div className="mb-8">
          <h2 className="text-xl font-bold">Event Finder</h2>
          <p className="text-sm text-muted-foreground">Ontdek evenementen</p>
        </div>
        <div className="space-y-1">
          <NavItems />
        </div>
      </div>

      {/* Mobile - hamburger menu and slide-in sidebar */}
      <div className="md:hidden">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10 fixed top-4 left-4 z-50">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold">Event Finder</h2>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="space-y-1">
              <NavItems />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}