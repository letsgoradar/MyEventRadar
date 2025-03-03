import React from 'react';
import { Home, PlusCircle, Calendar, Heart, User } from 'lucide-react';
import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';

export default function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 w-full flex items-center justify-between bg-white border-t border-gray-200 px-4 py-2 z-10">
      <Link href="/" className="flex-1">
        <Button
          variant="ghost"
          className="w-full py-6 hover:bg-gray-100"
          data-active={location === '/'}
        >
          <div className="flex flex-col items-center">
            <Home className="w-6 h-6 mb-1" />
            <span className="text-xs">Home</span>
          </div>
        </Button>
      </Link>

      <Link href="/create-event" className="flex-1">
        <Button
          variant="default"
          className="w-full h-[62px] flex flex-col items-center justify-center bg-[#0097FB] hover:bg-[#0087e1] text-white transform -translate-y-2 rounded-lg shadow-md"
        >
          <PlusCircle className="w-6 h-6 mb-1" />
          <span className="text-xs">Aanmaken</span>
        </Button>
      </Link>

      <Link href="/events" className="flex-1">
        <Button
          variant="ghost"
          className="w-full py-6 hover:bg-gray-100"
          data-active={location === '/events'}
        >
          <div className="flex flex-col items-center">
            <Calendar className="w-6 h-6 mb-1" />
            <span className="text-xs">Events</span>
          </div>
        </Button>
      </Link>

      <Link href="/favorites" className="flex-1">
        <Button
          variant="ghost"
          className="w-full py-6 hover:bg-gray-100"
          data-active={location === '/favorites'}
        >
          <div className="flex flex-col items-center">
            <Heart className="w-6 h-6 mb-1" />
            <span className="text-xs">Favorieten</span>
          </div>
        </Button>
      </Link>

      <Link href="/profile" className="flex-1">
        <Button
          variant="ghost"
          className="w-full py-6 hover:bg-gray-100"
          data-active={location === '/profile'}
        >
          <div className="flex flex-col items-center">
            <User className="w-6 h-6 mb-1" />
            <span className="text-xs">Profiel</span>
          </div>
        </Button>
      </Link>
    </nav>
  );
}