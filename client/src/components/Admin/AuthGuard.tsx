import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

type AdminAuthGuardProps = {
  children: React.ReactNode;
};

const AdminAuthGuard: React.FC<AdminAuthGuardProps> = ({ children }) => {
  const [_, setLocation] = useLocation();
  const [isChecking, setIsChecking] = useState(true);

  interface UserResponse {
    id: number;
    username: string;
    email: string;
    role: string;
  }

  const { data: user, isLoading, error, refetch } = useQuery<UserResponse>({
    queryKey: ['/api/auth/me'],
    retry: 2,
    refetchOnMount: true,
    staleTime: 0,
    gcTime: 0,
  });
  
  // Extra validation check to ensure authentication works
  useEffect(() => {
    const validateAuth = async () => {
      try {
        if (!isLoading && (error || !user)) {
          console.log('Running additional auth check...');
          // Make direct request to avoid cache issues
          const userData = await apiRequest<UserResponse>('/api/auth/me');
          if (userData && userData.role === 'admin') {
            console.log('Auth validated via direct request:', userData);
            refetch(); // Update the query cache
            setIsChecking(false);
            return;
          }
        }
        
        if (!isLoading) {
          setIsChecking(false);
          
          if (error || !user) {
            console.log('User not authenticated, redirecting to login');
            setLocation('/admin/login');
          } else if (user.role !== 'admin') {
            // User is authenticated but not an admin
            console.log('User is not an admin, redirecting to home');
            setLocation('/');
          } else {
            console.log('User authenticated successfully:', user);
          }
        }
      } catch (err) {
        console.error('Authentication validation error:', err);
        setIsChecking(false);
        setLocation('/admin/login');
      }
    };
    
    validateAuth();
  }, [isLoading, error, user, setLocation, refetch]);

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