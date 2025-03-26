import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

type AdminAuthGuardProps = {
  children: React.ReactNode;
};

const AdminAuthGuard: React.FC<AdminAuthGuardProps> = ({ children }) => {
  const [_, setLocation] = useLocation();
  const [isChecking, setIsChecking] = useState(true);

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['/api/auth/me'],
    retry: 1,
  });

  useEffect(() => {
    if (!isLoading) {
      setIsChecking(false);
      
      if (error || !user) {
        setLocation('/admin/login');
      } else if (user.role !== 'admin') {
        // User is authenticated but not an admin
        setLocation('/');
      }
    }
  }, [isLoading, error, user, setLocation]);

  if (isChecking) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Controleren...</span>
      </div>
    );
  }

  // Only render children if user is logged in and is an admin
  return user && user.role === 'admin' ? <>{children}</> : null;
};

export default AdminAuthGuard;