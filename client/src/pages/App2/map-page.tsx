import React, { useState, useEffect } from "react";
import { App2Layout } from "@/components/App2/App2Layout";
import MapView from "@/components/Map/MapView";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { List } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Event } from "@shared/schema";

export default function App2MapPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [radius, setRadius] = useState(10);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);

  // Geolocation ophalen
  const [userLocation, setUserLocation] = useState<[number, number]>([51.7767, 5.5345]);
  
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
          console.log("Got user location:", latitude, longitude);
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  }, []);

  // Events ophalen
  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ['/api/events/nearby', userLocation[0], userLocation[1], radius, searchQuery],
    enabled: userLocation[0] !== 0 && userLocation[1] !== 0,
  });

  // Events bijwerken wanneer ze opgehaald zijn
  useEffect(() => {
    if (events) {
      setFilteredEvents(events);
    }
  }, [events]);

  // Bij geen gebruiker, doorsturen naar welkomstscherm
  if (!user) {
    return <Redirect to="/app2/welcome" />;
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b">
        <div className="container py-3 px-4 flex justify-between items-center">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary mr-2">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
            <h1 className="text-xl font-semibold">Evenementen</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/app2/list">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-10 w-10"
                title="Naar lijstweergave"
              >
                <List className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Kaartweergave - beslaat volledig scherm onder header */}
      <div className="flex-1 relative">
        <div className="absolute inset-0">
          <MapView 
            filteredEvents={filteredEvents} 
            radius={radius} 
            searchQuery={searchQuery} 
            hideZoomControls={false}
          />
        </div>
      </div>
    </div>
  );
}