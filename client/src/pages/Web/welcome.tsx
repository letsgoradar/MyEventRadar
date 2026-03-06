import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FaGoogle, FaApple } from "react-icons/fa";
import { Mail, MapPin, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type { EventInterface } from "@shared/schema";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

function MapCenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.setView([lat, lng], 12);
  }, [lat, lng, map]);
  return null;
}

function createDotIcon(color: string) {
  return L.divIcon({
    className: "custom-div-icon",
    html: `<div style="background-color:${color};width:10px;height:10px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
}

export default function WebWelcomePage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const urlParams = new URLSearchParams(window.location.search);
  const returnTo = urlParams.get("returnTo") || "/web";

  const [locationStep, setLocationStep] = useState<"request" | "loading" | "done">("request");
  const [userLocation, setUserLocation] = useState<[number, number]>([52.1326, 5.2913]);

  const { data: googleStatus } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/auth/google/status"],
  });

  const { data: nearbyEvents } = useQuery<EventInterface[]>({
    queryKey: ["/api/events/nearby", userLocation[0], userLocation[1], 20],
    enabled: locationStep === "done",
  });

  useEffect(() => {
    if (user) setLocation(returnTo);
  }, [user, returnTo, setLocation]);

  const requestLocation = () => {
    setLocationStep("loading");
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          setUserLocation([coords.latitude, coords.longitude]);
          setLocationStep("done");
        },
        () => setLocationStep("done")
      );
    } else {
      setLocationStep("done");
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
  };

  const goToRegister = () => setLocation(`/web/register?returnTo=${encodeURIComponent(returnTo)}`);
  const goToLogin = () => setLocation(`/web/login?returnTo=${encodeURIComponent(returnTo)}`);
  const goToForgotPassword = () => setLocation("/web/login?forgot=true");

  return (
    <div className="relative w-full h-screen flex flex-col overflow-hidden">
      {/* Kaartachtergrond */}
      <div className="absolute inset-0 z-0">
        <div className="w-full h-full brightness-[0.45]">
          {locationStep === "done" && (
            <MapContainer
              center={userLocation}
              zoom={12}
              style={{ height: "100%", width: "100%" }}
              zoomControl={false}
              attributionControl={false}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
              />
              <MapCenter lat={userLocation[0]} lng={userLocation[1]} />
              <Marker
                position={userLocation}
                icon={L.divIcon({
                  className: "custom-user-icon",
                  html: `<div style="background-color:#3b82f6;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 0 3px rgba(59,130,246,0.4);"></div>`,
                  iconSize: [14, 14],
                  iconAnchor: [7, 7],
                })}
              />
              {nearbyEvents?.map((event) => (
                <Marker
                  key={event.id}
                  position={[Number(event.latitude), Number(event.longitude)]}
                  icon={createDotIcon("#f87171")}
                />
              ))}
            </MapContainer>
          )}
          {/* Statische kaartachtergrond als locatie nog niet geladen is */}
          {locationStep !== "done" && (
            <MapContainer
              center={[52.1326, 5.2913]}
              zoom={8}
              style={{ height: "100%", width: "100%" }}
              zoomControl={false}
              attributionControl={false}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
              />
            </MapContainer>
          )}
        </div>
      </div>

      {/* Inhoud */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full p-6">
        {locationStep === "request" && (
          <div className="w-full max-w-sm bg-background/95 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-border space-y-4">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-primary">Welkom bij letsgo radar</h1>
              <p className="text-muted-foreground text-sm">Ontdek evenementen in jouw buurt</p>
              <p className="text-xs text-muted-foreground">
                Om de beste evenementen in jouw omgeving te vinden, hebben we toegang tot je locatie nodig.
              </p>
            </div>
            <Button className="w-full flex items-center justify-center gap-2" onClick={requestLocation}>
              <MapPin className="h-4 w-4" />
              Deel mijn locatie
            </Button>
            <button
              onClick={() => setLocationStep("done")}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Overslaan
            </button>
          </div>
        )}

        {locationStep === "loading" && (
          <div className="w-full max-w-sm bg-background/95 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-border flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Je locatie wordt opgehaald...</p>
          </div>
        )}

        {locationStep === "done" && (
          <div className="w-full max-w-sm bg-background/95 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-border space-y-4">
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-bold text-primary">Welkom bij letsgo radar</h1>
              <p className="text-muted-foreground text-sm">
                {nearbyEvents?.length
                  ? `${nearbyEvents.length} evenementen gevonden in je buurt!`
                  : "Ontdek evenementen in jouw buurt"}
              </p>
              <p className="text-xs text-muted-foreground">
                Registreer of log in om alle details te bekijken
              </p>
            </div>

            <div className="space-y-3">
              {googleStatus?.enabled && (
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2 h-11"
                  onClick={handleGoogleLogin}
                >
                  <FaGoogle className="h-4 w-4" />
                  Doorgaan met Google
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full flex items-center justify-center gap-2 h-11 opacity-50 cursor-not-allowed"
                disabled
              >
                <FaApple className="h-4 w-4" />
                Doorgaan met Apple
                <span className="text-xs ml-1">(binnenkort)</span>
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-background/95 px-3 text-muted-foreground text-sm">of</span>
                </div>
              </div>

              <Button
                className="w-full flex items-center justify-center gap-2 h-11"
                onClick={goToRegister}
              >
                <Mail className="h-4 w-4" />
                Registreren met e-mail
              </Button>
            </div>

            <div className="space-y-2 text-center text-sm">
              <p>
                <span className="text-muted-foreground">Heb je al een account? </span>
                <button onClick={goToLogin} className="text-primary hover:underline font-medium">
                  Inloggen
                </button>
              </p>
              <button
                onClick={goToForgotPassword}
                className="text-muted-foreground hover:text-primary hover:underline text-sm"
              >
                Wachtwoord vergeten?
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
