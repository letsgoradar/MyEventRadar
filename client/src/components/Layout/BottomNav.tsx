import { Home, CalendarDays, Heart, User, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

function BottomNav({ activeTab, setActiveTab }: { activeTab: string; setActiveTab: (tab: string) => void }) {
  return (
    <nav className="flex items-center justify-between bg-white border-t border-gray-200 px-4 py-2">
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

      <div className="flex flex-col items-center">
            <PlusCircle className="w-6 h-6 mb-1" />
            <span className="text-xs">Nieuw</span>
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

        <Button
          variant="ghost"
          className="flex-1 py-6 hover:bg-gray-100"
          onClick={() => {
            setActiveTab('myEvents');
          }}
          data-active={activeTab === 'myEvents'}
        >
          <div className="flex flex-col items-center">
            <CalendarDays className="w-6 h-6 mb-1" />
            <span className="text-xs">Mijn events</span>
          </div>
        </Button>


      <Button
        variant="ghost"
        className="flex-1 py-6 hover:bg-gray-100"
        onClick={() => {
          setActiveTab('favorites');
        }}
        data-active={activeTab === 'favorites'}
      >
        <div className="flex flex-col items-center">
          <Heart className="w-6 h-6 mb-1" />
          <span className="text-xs">Favorieten</span>
        </div>
      </Button>

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