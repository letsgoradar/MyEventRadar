import React from "react";
import { LoginForm } from "@/components/App/LoginForm";
import AppLayout from "@/components/App/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";

export function AppLoginPage() {
  const { user } = useAuth();

  // Als een gebruiker al is ingelogd, stuur ze naar de hoofdpagina
  if (user) {
    return <Redirect to="/app" />;
  }

  return (
    <div className="relative min-h-screen bg-black/80">
      {/* Donkere achtergrond */}
      <div className="absolute inset-0 z-0 bg-black/60" />
      
      {/* Header met terugknop */}
      <div className="relative z-10 flex items-center p-4 border-b border-gray-800">
        <a href="/app/welcome" className="flex items-center text-white">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 mr-2"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          <span>Terug</span>
        </a>
        <h1 className="ml-4 text-xl font-semibold text-white">Inloggen</h1>
      </div>
      
      {/* Kleiner login kader */}
      <div className="flex flex-col items-center justify-center px-4 py-8 relative z-10 h-[calc(100vh-64px)]">
        <div className="w-full max-w-sm bg-background/95 backdrop-blur-sm rounded-lg shadow-lg p-6 border border-border">
          <h1 className="text-xl font-bold mb-2 text-center">Welkom terug</h1>
          <p className="text-muted-foreground text-center mb-6 text-sm">
            Log in om evenementen te ontdekken
          </p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}

export default AppLoginPage;