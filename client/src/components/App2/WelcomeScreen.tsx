import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FaGoogle, FaApple } from "react-icons/fa";
import { Mail, MapPin, Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { isNativeApp, getApiBaseUrl } from "@/lib/capacitor";
import { Event } from "@shared/schema";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { motion, AnimatePresence } from "framer-motion";

// Fix voor Leaflet iconen in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

// Functie om een eenvoudige marker-icoon te maken
function createSimpleIcon(color: string) {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

// Component om de kaart automatisch te centreren op gebruiker
function MapCenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  
  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], 13);
    }
  }, [lat, lng, map]);
  
  return null;
}

export function WelcomeScreen() {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [locationStep, setLocationStep] = useState<'request' | 'loading' | 'loaded' | 'error'>('request');
  const [userLocation, setUserLocation] = useState<[number, number]>([51.7767, 5.5345]); // Default locatie
  const [showLoginForm, setShowLoginForm] = useState(false);
  
  // Animatie states
  const [startAnimation, setStartAnimation] = useState(false);
  const [navigateTo, setNavigateTo] = useState<string | null>(null);

  // Haal evenementen op in de buurt van de gebruiker
  const { data: nearbyEvents, isLoading: isLoadingEvents } = useQuery<Event[]>({
    queryKey: ['/api/events/nearby', userLocation[0], userLocation[1], 20], // Grotere radius om meer events te tonen
    enabled: locationStep === 'loaded',
  });

  // Effect voor navigatie met vertraging na animatie
  useEffect(() => {
    if (navigateTo && startAnimation) {
      const timer = setTimeout(() => {
        setLocation(navigateTo);
      }, 300); // Korte vertraging voor animatie-effect

      return () => clearTimeout(timer);
    }
  }, [navigateTo, startAnimation, setLocation]);

  const handleGoogleLogin = () => {
    const base = isNativeApp() ? getApiBaseUrl() : '';
    const nativeParam = isNativeApp() ? '&nativeApp=true' : '';
    window.location.href = `${base}/api/auth/google?returnTo=/app${nativeParam}`;
  };

  const handleAppleLogin = () => {
    console.log("Apple login komt binnenkort");
  };

  const goToLogin = () => {
    setStartAnimation(true);
    setNavigateTo("/app2/login");
  };

  const goToRegister = () => {
    setStartAnimation(true);
    setNavigateTo("/app2/register");
  };

  const goToForgotPassword = () => {
    setStartAnimation(true);
    setNavigateTo("/app2/forgot-password");
  };

  // Functie om locatie op te vragen
  const requestLocation = () => {
    setLocationStep('loading');
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
          setLocationStep('loaded');
          setShowLoginForm(true);
        },
        (error) => {
          setLocationStep('error');
          // Toon alsnog het inlogformulier bij een fout
          setShowLoginForm(true);
        }
      );
    } else {
      console.error("Geolocation is not supported by this browser.");
      setLocationStep('error');
      setShowLoginForm(true);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Kaart als achtergrond (wordt donker weergegeven maar tekst blijft leesbaar) */}
      <div className="absolute inset-0 z-0">
        <div className="w-full h-full brightness-[0.45] opacity-90">
          {locationStep === 'loaded' && (
            <motion.div 
              id="map-container" 
              className="w-full h-full"
              initial={{ opacity: 1 }}
              animate={{ 
                opacity: startAnimation ? 0.7 : 1,
                scale: startAnimation ? 1.1 : 1,
              }}
              transition={{ duration: 0.3 }}
            >
              <MapContainer
                center={userLocation}
                zoom={9}
                style={{ height: "100%", width: "100%" }}
                zoomControl={false}
                attributionControl={false}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  subdomains="abcd"
                />
                
                {/* Component om de kaart te centreren op de gebruiker */}
                <MapCenter lat={userLocation[0]} lng={userLocation[1]} />
                
                {/* Marker voor gebruiker locatie */}
                <Marker 
                  position={userLocation}
                  icon={L.divIcon({
                    className: 'custom-user-icon',
                    html: `<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);"></div>`,
                    iconSize: [16, 16],
                    iconAnchor: [8, 8],
                  })}
                />
                
                {/* Markers voor events */}
                {nearbyEvents?.map((event) => (
                  <Marker 
                    key={event.id}
                    position={[Number(event.latitude), Number(event.longitude)]}
                    icon={createSimpleIcon('#f87171')}
                  />
                ))}
              </MapContainer>
            </motion.div>
          )}
        </div>
      </div>

      {/* Voorgrond content */}
      <AnimatePresence>
        <motion.div 
          className="relative z-10 flex flex-col items-center justify-center p-6 mt-8 h-full"
          initial={{ opacity: 1 }}
          animate={{ opacity: startAnimation ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {locationStep === 'request' && (
            <div className="w-full max-w-md bg-background/95 backdrop-blur-sm rounded-lg shadow-lg p-6 border border-border">
              <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold text-primary mb-2">Welkom bij MyEventRadar.com</h1>
                <p className="text-muted-foreground mb-4">
                  Ontdek evenementen in jouw buurt
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  Om de beste evenementen in jouw omgeving te vinden, hebben we toegang tot je locatie nodig.
                </p>
              </div>
              
              <Button 
                variant="default" 
                className="w-full flex items-center justify-center gap-2"
                onClick={requestLocation}
              >
                <MapPin className="h-4 w-4" />
                <span>Deel mijn locatie</span>
              </Button>
            </div>
          )}
          
          {locationStep === 'loading' && (
            <div className="w-full max-w-md bg-background/95 backdrop-blur-sm rounded-lg shadow-lg p-8 border border-border flex flex-col items-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-center">Je locatie wordt opgehaald...</p>
            </div>
          )}
          
          {(locationStep === 'loaded' || locationStep === 'error' || showLoginForm) && (
            <div className="w-full max-w-md bg-background/95 backdrop-blur-sm rounded-lg shadow-lg p-6 border border-border">
              <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold text-primary mb-2">Welkom bij MyEventRadar.com</h1>
                <p className="text-muted-foreground mb-2">
                  {nearbyEvents?.length ? 
                    `${nearbyEvents.length} evenementen gevonden in je buurt!` : 
                    "Ontdek evenementen in jouw buurt"}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Registreer of log in om alle details te bekijken
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
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}