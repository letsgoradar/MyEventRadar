import React, { useState } from 'react';
import { Home, Plus, User, Heart, Calendar } from 'lucide-react';
import { useLocation } from 'wouter';


interface BottomNavProps {
  currentTab: 'explore' | 'my-events' | 'favorites' | 'profile';
  setCurrentTab: (tab: 'explore' | 'my-events' | 'favorites' | 'profile') => void;
}

export default function BottomNav({ currentTab, setCurrentTab }: BottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleTabClick = (tab: 'explore' | 'my-events' | 'favorites' | 'profile', path: string) => {
    setCurrentTab(tab);
    if (location.pathname !== path) {
      navigate(path);
    }
  };

  return (
    <nav className="fixed bottom-0 w-full bg-background border-t border-border h-[58px] flex items-center justify-around z-10">
      <button
        onClick={() => handleTabClick('explore', '/')}
        className={`flex flex-col items-center justify-center p-2 ${
          currentTab === 'explore' ? 'text-[#0097FB]' : 'text-muted-foreground'
        }`}
      >
        <Home className="h-5 w-5" />
        <span className="text-xs mt-1">Home</span>
      </button>

      <button
        onClick={() => handleTabClick('my-events', '/my-events')}
        className={`flex flex-col items-center justify-center p-2 ${
          currentTab === 'my-events' ? 'text-[#0097FB]' : 'text-muted-foreground'
        }`}
      >
        <Calendar className="h-5 w-5" />
        <span className="text-xs mt-1">My Events</span>
      </button>

      <Link to="/create" className="flex flex-col items-center justify-center p-2">
        <Plus className="h-5 w-5" />
        <span className="text-xs mt-1">Aanmaken</span>
      </Link>

      <button
        onClick={() => handleTabClick('favorites', '/favorites')}
        className={`flex flex-col items-center justify-center p-2 ${
          currentTab === 'favorites' ? 'text-[#0097FB]' : 'text-muted-foreground'
        }`}
      >
        <Heart className="h-5 w-5" />
        <span className="text-xs mt-1">Favorieten</span>
      </button>

      <button
        onClick={() => handleTabClick('profile', '/profile')}
        className={`flex flex-col items-center justify-center p-2 ${
          currentTab === 'profile' ? 'text-[#0097FB]' : 'text-muted-foreground'
        }`}
      >
        <User className="h-5 w-5" />
        <span className="text-xs mt-1">Profiel</span>
      </button>
    </nav>
  );
}