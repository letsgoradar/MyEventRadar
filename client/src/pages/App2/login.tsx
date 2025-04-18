import React from "react";
import { LoginForm } from "@/components/App2/LoginForm";
import { App2Layout } from "@/components/App2/App2Layout";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";

export default function LoginPage() {
  const { user } = useAuth();

  // Als een gebruiker al is ingelogd, stuur ze naar de hoofdpagina
  if (user) {
    return <Redirect to="/app2" />;
  }

  return (
    <App2Layout 
      title="Inloggen" 
      hideBottomNav 
      showBackButton
      backTo="/app2/welcome"
    >
      <div className="flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold mb-2 text-center">Welkom terug</h1>
          <p className="text-muted-foreground text-center mb-6">
            Log in om evenementen te ontdekken
          </p>
          <LoginForm />
        </div>
      </div>
    </App2Layout>
  );
}