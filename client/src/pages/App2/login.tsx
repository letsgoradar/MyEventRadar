import React from 'react';
import { App2Layout } from '@/components/App2/App2Layout';
import { App2LoginForm } from '@/components/App2/LoginForm';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';

export default function App2LoginPage() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  // Redirect to app home if user is already logged in
  React.useEffect(() => {
    if (user) {
      navigate('/app2');
    }
  }, [user, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  return (
    <App2Layout 
      title="Inloggen" 
      hideBottomNav={true} 
      hideBackButton={true}
    >
      <div className="container mx-auto p-4 flex flex-col h-[90vh] items-center justify-center">
        <div className="flex flex-col w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Inloggen</h1>
            <p className="text-muted-foreground mt-2">
              Log in om toegang te krijgen tot je account
            </p>
          </div>
          
          <App2LoginForm redirectPath="/app2" />
        </div>
      </div>
    </App2Layout>
  );
}