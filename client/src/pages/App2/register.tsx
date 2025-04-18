import React from 'react';
import { App2RegisterForm } from '@/components/App2/RegisterForm';
import { App2Layout } from '@/components/App2/App2Layout';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';

export default function App2RegisterPage() {
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
    <App2Layout hideBottomNav hideBackButton>
      <div className="container mx-auto p-4 flex flex-col h-[90vh] items-center justify-center">
        <div className="flex flex-col w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Account aanmaken</h1>
            <p className="text-muted-foreground mt-2">
              Maak een account aan om evenementen te vinden en te maken in jouw buurt
            </p>
          </div>
          
          <App2RegisterForm />
        </div>
      </div>
    </App2Layout>
  );
}