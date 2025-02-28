import React from 'react';
import { Home, PlusCircle, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 w-full flex items-center justify-between bg-white border-t border-gray-200 px-4 py-2 z-10">
      <Button
        variant="ghost"
        className="flex-1 py-6 hover:bg-gray-100"
        onClick={() => {
          setActiveTab('home');
        }}
        data-active={activeTab === 'home'}
      >
        <div className="flex flex-col items-center">
          <Home className="w-6 h-6 mb-1" />
          <span className="text-xs">Home</span>
        </div>
      </Button>

      <Link to="/create-event" className="flex-1">
        <Button
          variant="default"
          className="w-full h-[62px] flex flex-col items-center justify-center bg-[#0097FB] hover:bg-[#0087e1] text-white transform -translate-y-2 rounded-lg shadow-md"
        >
          <PlusCircle className="w-6 h-6 mb-1" />
          <span className="text-xs">Aanmaken</span>
        </Button>
      </Link>

      <Link to="/events" className="flex-1"> {/* Added link to /events */}
        <Button
          variant="ghost"
          className="flex-1 py-6 hover:bg-gray-100"
        >
          <div className="flex flex-col items-center">
            <Calendar className="w-6 h-6 mb-1" /> {/* Added Calendar icon */}
            <span className="text-xs">Events</span>
          </div>
        </Button>
      </Link>

      <Button
        variant="ghost"
        className="flex-1 py-6 hover:bg-gray-100"
        onClick={() => {
          setActiveTab('profile');
        }}
        data-active={activeTab === 'profile'}
      >
        <div className="flex flex-col items-center">
          <User className="w-6 h-6 mb-1" />
          <span className="text-xs">Profiel</span>
        </div>
      </Button>
    </nav>
  );
}

export default BottomNav;