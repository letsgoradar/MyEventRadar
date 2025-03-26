import React from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  BarChart, 
  Users, 
  Calendar, 
  LogOut,
  Home
} from 'lucide-react';

const AdminNav: React.FC = () => {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/auth/logout', {
        method: 'POST',
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: 'Uitgelogd',
        description: 'Je bent succesvol uitgelogd.',
      });
      setLocation('/admin/login');
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Uitloggen mislukt',
        description: 'Er is een fout opgetreden bij het uitloggen.',
      });
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-4">
        <div className="flex items-center space-x-4 mr-4">
          <span className="text-xl font-bold">Admin Portal</span>
        </div>
        <div className="flex items-center space-x-2">
          <Link href="/admin/dashboard">
            <Button
              variant={location === '/admin/dashboard' ? 'default' : 'ghost'}
              size="sm"
              className="text-sm"
            >
              <BarChart className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <Link href="/admin/users">
            <Button
              variant={location === '/admin/users' ? 'default' : 'ghost'}
              size="sm"
              className="text-sm"
            >
              <Users className="mr-2 h-4 w-4" />
              Gebruikers
            </Button>
          </Link>
          <Link href="/admin/events">
            <Button
              variant={location === '/admin/events' ? 'default' : 'ghost'}
              size="sm"
              className="text-sm"
            >
              <Calendar className="mr-2 h-4 w-4" />
              Evenementen
            </Button>
          </Link>
        </div>
        <div className="ml-auto flex items-center space-x-2">
          <Link href="/">
            <Button
              variant="ghost"
              size="sm"
              className="text-sm"
            >
              <Home className="mr-2 h-4 w-4" />
              Naar hoofdsite
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="text-sm"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Uitloggen
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminNav;