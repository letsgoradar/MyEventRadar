import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Map, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Event } from "@shared/schema";
import { Input } from "@/components/ui/input";
import EventList from "@/components/Events/EventList";
import { Badge } from "@/components/ui/badge";
import App2BottomNav from "@/components/App2/App2BottomNav";

export default function App2ListPage() {
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

  // Zoekfunctie
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Zoekfunctie uitvoeren
  const performSearch = () => {
    // Als er events zijn, filter deze op basis van zoekterm
    if (events) {
      const filtered = events.filter(event => 
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (event.description && event.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredEvents(filtered);
    }
  };

  // Bij geen gebruiker, doorsturen naar welkomstscherm
  if (!user) {
    return <Redirect to="/app2/welcome" />;
  }

  return (
    <div className="flex flex-col min-h-screen">
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
            <Link href="/app2/map">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-10 w-10"
                title="Naar kaartweergave"
              >
                <Map className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Zoekbalk */}
      <div className="container mt-2 px-4">
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Input
              placeholder="Zoek evenementen..."
              value={searchQuery}
              onChange={handleSearch}
              className="pl-9 pr-4 h-10 w-full border-gray-300"
              onKeyDown={(e) => e.key === "Enter" && performSearch()}
            />
            <Search 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" 
              onClick={performSearch}
            />
          </div>
        </div>

        {/* Filter tags */}
        {searchQuery && (
          <div className="flex flex-wrap gap-2 mb-3">
            <Badge className="flex gap-1 items-center bg-primary/10 hover:bg-primary/20 text-primary border-none">
              <span className="truncate">{searchQuery}</span>
            </Badge>
          </div>
        )}
      </div>

      {/* Lijst weergave */}
      <div className="flex-1 overflow-auto pb-16">
        <EventList
          events={filteredEvents}
          isLoading={isLoading}
          radius={radius}
          searchQuery={searchQuery}
        />
      </div>

      {/* Bottom navigation */}
      <App2BottomNav />
    </div>
  );
}