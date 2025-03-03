import React from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Menu, X, Search, Plus, Map, List } from 'lucide-react';
import { Input } from "@/components/ui/input";
import Logo from '../ui/logo';

interface TopNavProps {
  isMapView?: boolean;
  toggleView?: () => void;
  toggleFilterSheet?: () => void;
  isFilterSheetOpen?: boolean;
  setIsFilterSheetOpen?: (open: boolean) => void;
}

const TopNav: React.FC<TopNavProps> = ({ 
  isMapView, 
  toggleView, 
  toggleFilterSheet, 
  isFilterSheetOpen,
  setIsFilterSheetOpen 
}) => {
  return (
    <nav className="fixed top-0 w-full h-14 bg-[#0097FB] shadow-md z-10 flex items-center justify-between px-4">
      <div className="flex items-center">
        <Link href="/" className="flex items-center">
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
        <Button 
          onClick={toggleFilterSheet} 
          variant="ghost" 
          size="icon" 
          className="text-white hover:bg-blue-600"
        >
          <Search className="h-5 w-5" />
        </Button>

        <Button 
          onClick={toggleView} 
          variant="ghost" 
          size="icon" 
          className="text-white hover:bg-blue-600"
        >
          {isMapView ? <List className="h-5 w-5" /> : <Map className="h-5 w-5" />}
        </Button>

        <Link href="/create-event">
          <Button variant="ghost" size="icon" className="text-white hover:bg-blue-600">
            <Plus className="h-5 w-5" />
          </Button>
        </Link>
      </div>
    </nav>
  );
};

export default TopNav;