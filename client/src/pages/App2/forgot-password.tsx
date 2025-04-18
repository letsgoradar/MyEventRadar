import React from "react";
import { App2Layout } from "@/components/App2/App2Layout";
import { ForgotPasswordForm } from "@/components/App2/ForgotPasswordForm";
import { Navigate } from "wouter";
import { useAuth } from "@/hooks/use-auth";

export default function ForgotPasswordPage() {
  const { user } = useAuth();

  // Als een gebruiker al is ingelogd, stuur ze naar de hoofdpagina
  if (user) {
    return <Navigate to="/app2" />;
  }

  return (
    <App2Layout 
      title="Wachtwoord Reset" 
      hideBottomNav 
      showBackButton
      backTo="/app2/welcome"
    >
      <div className="flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold mb-2 text-center">Wachtwoord vergeten?</h1>
          <p className="text-muted-foreground text-center mb-6">
            Vul je e-mailadres in en we sturen je een link om je wachtwoord te resetten.
          </p>
          <ForgotPasswordForm />
        </div>
      </div>
    </App2Layout>
  );
}