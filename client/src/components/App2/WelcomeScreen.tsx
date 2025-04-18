import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FaGoogle, FaApple } from "react-icons/fa";
import { Mail, Lock } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";

export function WelcomeScreen() {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  
  // Als de gebruiker al is ingelogd, doorsturen naar de hoofdpagina
  React.useEffect(() => {
    if (user) {
      setLocation("/app2");
    }
  }, [user, setLocation]);

  const handleGoogleLogin = () => {
    // TODO: Implementeer Google login
    console.log("Google login");
  };

  const handleAppleLogin = () => {
    // TODO: Implementeer Apple login
    console.log("Apple login");
  };

  const goToLogin = () => {
    setLocation("/app2/login");
  };

  const goToRegister = () => {
    setLocation("/app2/register");
  };

  const goToForgotPassword = () => {
    setLocation("/app2/forgot-password");
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Vage/donkere kaart achtergrond */}
      <div className="absolute inset-0 z-0 bg-black/50">
        <div className="w-full h-full blur-sm brightness-50 opacity-80">
          <div id="map-container" className="w-full h-full"></div>
        </div>
      </div>

      {/* Voorgrond content */}
      <div className="relative z-10 flex flex-col items-center justify-center p-6 mt-8 h-full">
        <div className="w-full max-w-md bg-background/95 backdrop-blur-sm rounded-lg shadow-lg p-6 border border-border">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-primary mb-2">Welkom bij EventApp</h1>
            <p className="text-muted-foreground">
              Ontdek evenementen in jouw buurt
            </p>
          </div>

          <div className="space-y-4">
            <Button 
              variant="outline" 
              className="w-full flex items-center justify-center gap-2"
              onClick={handleGoogleLogin}
            >
              <FaGoogle className="h-4 w-4" />
              <span>Doorgaan met Google</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full flex items-center justify-center gap-2"
              onClick={handleAppleLogin}
            >
              <FaApple className="h-4 w-4" />
              <span>Doorgaan met Apple</span>
            </Button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-2 text-muted-foreground text-sm">
                  of
                </span>
              </div>
            </div>

            <Button 
              variant="default" 
              className="w-full flex items-center justify-center gap-2"
              onClick={goToRegister}
            >
              <Mail className="h-4 w-4" />
              <span>Registreren met e-mail</span>
            </Button>
            
            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Heb je al een account?</span>{" "}
              <button 
                onClick={goToLogin} 
                className="text-primary hover:underline font-medium"
              >
                Inloggen
              </button>
            </div>
            
            <div className="text-center text-sm">
              <button 
                onClick={goToForgotPassword} 
                className="text-muted-foreground hover:text-primary hover:underline"
              >
                Wachtwoord vergeten?
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}