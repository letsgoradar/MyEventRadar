import React from "react";
import { WelcomeScreen } from "@/components/App2/WelcomeScreen";
import { Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";

export default function WelcomePage() {
  const { user, isLoading } = useAuth();

  // Toon loading indicator tijdens het controleren van de authenticatie
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Laden...</div>;
  }

  // Als gebruiker is ingelogd, doorsturen naar hoofdpagina
  if (user) {
    return <Redirect to="/app2" />;
  }

  return <WelcomeScreen />;
}