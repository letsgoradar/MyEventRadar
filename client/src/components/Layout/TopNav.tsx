
import React from 'react';
import { Link } from 'wouter';
import { Bell, UserCircle, Filter, List, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TopNavProps {
  toggleFilterSheet?: () => void;
  isMapView?: boolean;
  toggleView?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({ 
  toggleFilterSheet, 
  isMapView, 
  toggleView 
}) => {
  return (
    <nav className="p-3 bg-blue-600 text-white shadow-lg sticky top-0 z-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-xl font-bold">
          Evenementen
        </Link>
        <div className="flex space-x-2 items-center">
          {toggleFilterSheet && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={toggleFilterSheet}
              className="text-white"
            >
              <Filter className="h-5 w-5" />
            </Button>
          )}
          
          {toggleView && isMapView !== undefined && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={toggleView}
              className="text-white"
            >
              {isMapView ? <List className="h-5 w-5" /> : <Map className="h-5 w-5" />}
            </Button>
          )}
          
          <Button asChild variant="ghost">
            <Link href="/event/create">Aanmaken</Link>
          </Button>
          <Button variant="ghost" size="icon">
            <Bell className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <UserCircle className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default TopNav;
