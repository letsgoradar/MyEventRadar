import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const TopNav: React.FC = () => {
  return (
    <nav className="p-3 bg-blue-600 text-white shadow-lg sticky top-0 z-10">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-xl font-bold">
          Evenementen
        </Link>
        <div className="flex space-x-4">
          <Button asChild variant="ghost">
            <Link to="/event/create">Aanmaken</Link>
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