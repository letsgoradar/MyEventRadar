import React from "react";
import { WelcomeScreen } from "@/components/App/WelcomeScreen";
import { Redirect, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

export function AppWelcomePage() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Direct navigeren naar hoofdpagina wanneer gebruiker is ingelogd
  React.useEffect(() => {
    if (user && !isLoading) {
      setLocation("/app");
    }
  }, [user, isLoading, setLocation]);

  // Toon loading indicator tijdens het controleren van de authenticatie
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Als we hier komen, is de gebruiker niet ingelogd of is er nog geen controle uitgevoerd
  return <WelcomeScreen />;
}

export default AppWelcomePage;