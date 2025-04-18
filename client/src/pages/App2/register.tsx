import React from "react";
import { RegisterForm } from "@/components/App2/RegisterForm";
import { App2Layout } from "@/components/App2/App2Layout";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";

export default function RegisterPage() {
  const { user } = useAuth();

  // Als een gebruiker al is ingelogd, stuur ze naar de hoofdpagina
  if (user) {
    return <Redirect to="/app2" />;
  }

  return (
    <App2Layout 
      title="Registreren" 
      hideBottomNav 
      showBackButton
      backTo="/app2/welcome"
    >
      <div className="flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold mb-2 text-center">Account aanmaken</h1>
          <p className="text-muted-foreground text-center mb-6">
            Maak een nieuw account aan om evenementen te ontdekken.
          </p>
          <RegisterForm />
        </div>
      </div>
    </App2Layout>
  );
}