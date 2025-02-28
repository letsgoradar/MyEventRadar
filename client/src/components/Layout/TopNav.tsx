import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X, Search, Plus } from 'lucide-react';
import { Input } from "@/components/ui/input";
import Logo from '../ui/logo';

import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X, Search } from 'lucide-react';
import { Input } from "@/components/ui/input";
import Logo from '../ui/logo';

interface TopNavProps {
  toggleSidebar: () => void;
  isSidebarOpen: boolean;
}

const TopNav: React.FC<TopNavProps> = ({ toggleSidebar, isSidebarOpen }) => {
  return (
    <nav className="fixed top-0 w-full h-14 bg-[#0097FB] shadow-md z-10 flex items-center justify-between px-4">
      <div className="flex items-center">
        <button 
          onClick={toggleSidebar} 
          className="mr-4 p-1 rounded hover:bg-blue-600 transition duration-200 text-white"
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <Link to="/" className="flex items-center">
          <Logo className="w-8 h-8 text-white" />
          <span className="ml-2 text-white text-lg font-semibold">EventApp</span>
        </Link>
      </div>

      <div className="flex-1 mx-4 max-w-md relative hidden sm:block">
        <div className="relative w-full">
          <Input
            type="text"
            placeholder="Zoeken..."
            className="pl-10 w-full bg-blue-600/20 text-white placeholder:text-blue-100 border-blue-400 focus:border-white"
          />
          <Search className="absolute left-3 top-2.5 text-blue-100 w-4 h-4" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* We verwijderen hier de "Evenement aanmaken" button die naar BottomNav is verplaatst */}
      </div>
    </nav>
  );
};

export default TopNav;