import React, { useState, useEffect } from 'react';
import { Redirect } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Shield, Loader, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'moderator'; // Default to admin if not specified
}

const AuthGuard: React.FC<AuthGuardProps> = ({ 
  children, 
  requiredRole = 'admin' 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Fetch the current user
  const { data: user, isError, error } = useQuery<User>({
    queryKey: ['/api/auth/me'],
    retry: false,
  });
  
  useEffect(() => {
    if (!isLoading) return;
    
    // Check if the query is done loading
    if (user !== undefined || isError) {
      setIsLoading(false);
      
      // Log activity for successful login to admin panel
      if (user && (user.role === 'admin' || user.role === 'moderator')) {
        apiRequest('/api/admin/log-activity', {
          method: 'POST',
          data: {
            userId: user.id,
            activityType: 'login',
            details: { 
              section: 'admin_panel',
              role: user.role
            }
          }
        }).catch(err => {
          console.error('Failed to log admin login:', err);
        });
      }
      
      // Set error message if there's a problem
      if (isError) {
        setAuthError('Er is een fout opgetreden bij het controleren van je authenticatie. Probeer opnieuw in te loggen.');
      } else if (user && user.role !== requiredRole && !(requiredRole === 'moderator' && user.role === 'admin')) {
        setAuthError(`Je hebt geen toegang tot dit gedeelte. Je huidige rol is "${user.role}" maar "${requiredRole}" is vereist.`);
      }
    }
  }, [user, isError, isLoading, requiredRole]);
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-muted/40">
        <div className="w-full max-w-md p-8 space-y-6 bg-background rounded-xl shadow-lg">
          <div className="flex justify-center">
            <Loader className="h-10 w-10 animate-spin text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-center">
            Admin toegang controleren...
          </h1>
          <p className="text-center text-muted-foreground">
            Even geduld terwijl we je toegangsrechten verifiëren.
          </p>
        </div>
      </div>
    );
  }
  
  // Show error
  if (authError || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-muted/40">
        <div className="w-full max-w-md p-8 space-y-6 bg-background rounded-xl shadow-lg">
          <div className="flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-10 w-10 text-red-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-red-600">
            Toegang geweigerd
          </h1>
          <p className="text-center text-muted-foreground">
            {authError || 'Je moet ingelogd zijn met admin rechten om toegang te krijgen tot dit gedeelte.'}
          </p>
          <div className="flex justify-center pt-4">
            <Button asChild>
              <a href="/login">Inloggen</a>
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // Check if user has required role
  const hasRequiredRole = 
    user.role === requiredRole || 
    (requiredRole === 'moderator' && user.role === 'admin');
  
  if (!hasRequiredRole) {
    return <Redirect to="/login" />;
  }
  
  // User is authenticated and has required role
  return <>{children}</>;
};

export default AuthGuard;