import React from 'react';
import { App2LoginForm } from '@/components/App2/LoginForm';
import { useLocation } from 'wouter';

export function App2LoginPage() {
  // We kunnen eventuele query parameters gebruiken om de redirect URL te bepalen
  const [location] = useLocation();
  const redirectPath = new URLSearchParams(location.split('?')[1]).get('redirect') || '/app2';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-4 px-4 text-center">
        <h1 className="text-xl font-bold">Inloggen</h1>
      </header>
      
      {/* Content */}
      <main className="flex-1 p-4 flex items-center justify-center">
        <div className="w-full max-w-md">
          <App2LoginForm redirectPath={redirectPath} />
        </div>
      </main>
    </div>
  );
}

export default App2LoginPage;