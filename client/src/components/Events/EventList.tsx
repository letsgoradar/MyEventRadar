import React, { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchEventsByRadius } from "@/lib/api";
import { Event } from "@shared/schema";
import EventCard from "./EventCard";
import { Button } from "@/components/ui/button";
import { useLocation } from "@/hooks/useLocation";
import CategoryIcon from './CategoryIcon'; // Added import statement

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c * 10) / 10;
}

// Definieer de getCategoryColor functie
const getCategoryColor = (category: string): string => {
  const colorMap: Record<string, string> = {
    festival: '#FF9800',  // oranje
    food: '#4CAF50',      // groen
    culture: '#9C27B0',   // paars
    sports: '#2196F3',    // blauw
    market: '#FF5722',    // donkeroranje
    education: '#607D8B', // blauwgrijs
    music: '#E91E63',     // roze
    technology: '#00BCD4', // lichtblauw
    gaming: '#8BC34A',    // lichtgroen
    health: '#FFEB3B',    // geel
    nature: '#795548',    // bruin
  };

  return colorMap[category] || '#9E9E9E'; // grijs als fallback
};

function EventList() {
  const { location } = useLocation();
  const [radius, setRadius] = useState(10); // increased default radius
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [subcategoryFilter, setSubcategoryFilter] = useState<string | null>(null);
  const [filteredEvents, setFilteredEvents] = useState<Array<Event & { distance: number }>>([]);

  // Use a larger initial radius to get more events
  const { data: events, isLoading, isError, error } = useQuery({
    queryKey: ["events", location?.lat, location?.lng, radius],
    queryFn: async () => {
      if (!location) return [];
      console.log("Fetching events with params:", {lat: location.lat, lng: location.lng, radius});
      try {
        return fetchEventsByRadius(location.lat, location.lng, radius);
      } catch (err) {
        console.error("Failed to fetch events:", err);
        return []; // Return empty array as fallback
      }
    },
    enabled: !!location,
    // Improved retry options to handle network issues
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * (2 ** attemptIndex), 10000), // Exponential backoff
    // Default to empty array
    placeholderData: [],
  });

  // Process events and calculate distances
  useEffect(() => {
    if (!events || !location) return;

    console.log("Debug - Fetched events:", events);

    // Calculate distance for each event and sort by distance
    const eventsWithDistance = events.map((event: Event) => ({
      ...event,
      distance: calculateDistance(
        location.lat,
        location.lng,
        event.latitude,
        event.longitude
      )
    }));

    // Sort by distance
    eventsWithDistance.sort((a, b) => a.distance - b.distance);

    // Apply filters only if they're specified
    let filtered = [...eventsWithDistance];

    if (categoryFilter) {
      filtered = filtered.filter(event => event.category === categoryFilter);
    }

    if (subcategoryFilter) {
      filtered = filtered.filter(event => event.subcategory === subcategoryFilter);
    }

    console.log("Debug - Filtered events:", filtered.length, "events");

    if (filtered.length === 0) {
      console.log("Geen evenementen gevonden met deze filters.");
    }

    setFilteredEvents(filtered);
  }, [events, categoryFilter, subcategoryFilter, location]);

  const incrementRadius = useCallback(() => {
    setRadius(prev => prev + 5);
  }, []);

  if (isLoading) {
    return (
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-200 rounded-lg p-6">
            <div className="flex justify-between mb-4">
              <div className="h-6 w-20 bg-gray-300 rounded"></div>
              <div className="h-6 w-16 bg-gray-300 rounded"></div>
            </div>
            <div className="h-6 bg-gray-300 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-300 rounded w-1/2 mb-4"></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                <div className="h-12 bg-gray-300 rounded mt-2"></div>
              </div>
              <div className="h-[120px] bg-gray-300 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500 font-medium mb-2">Er is een fout opgetreden bij het ophalen van evenementen.</p>
        <p className="text-sm text-gray-600 mb-4">
          {error instanceof Error ? error.message : "Probeer het later opnieuw."}
        </p>
        <Button onClick={() => window.location.reload()}>
          Vernieuwen
        </Button>
      </div>
    );
  }

  if (filteredEvents.length === 0 && events && events.length > 0) {
    // We have events but they're filtered out
    return (
      <div className="p-4 flex flex-col items-center">
        <p className="mb-4 text-center">
          Er zijn evenementen beschikbaar, maar ze voldoen niet aan je huidige filters. Probeer de filters aan te passen.
        </p>
        {categoryFilter || subcategoryFilter ? (
          <Button onClick={() => {
            setCategoryFilter(null);
            setSubcategoryFilter(null);
          }}>
            Filters wissen
          </Button>
        ) : (
          <Button onClick={incrementRadius}>
            Zoekbereik vergroten ({radius} km → {radius + 5} km)
          </Button>
        )}
      </div>
    );
  } else if (filteredEvents.length === 0) {
    // No events at all
    return (
      <div className="p-4 flex flex-col items-center">
        <p className="mb-4 text-center">
          Geen evenementen gevonden in de buurt. Probeer een grotere zoekafstand.
        </p>
        <Button onClick={incrementRadius}>
          Zoekbereik vergroten ({radius} km → {radius + 5} km)
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 overflow-auto max-h-[calc(100vh-10rem)]">
      <div className="mb-3">
        <div className="flex flex-wrap gap-2 mb-3">
          {["festival", "food", "culture", "sports", "market", "education", "music", "technology", "gaming", "health", "nature"].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-full text-xs transition-all ${
                categoryFilter === cat 
                  ? 'border-2 border-primary shadow-sm scale-105' 
                  : 'border border-muted hover:border-muted/80'
              }`}
              title={cat.charAt(0).toUpperCase() + cat.slice(1)}
            >
              <CategoryIcon category={cat} size="sm" className="mr-1" style={{color: getCategoryColor(cat)}} />
              <span>{cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
            </button>
          ))}
        </div>
      </div>
      {filteredEvents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEvents.map((event) => (
            <EventCard key={event.id} event={event} distance={event.distance} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          Geen evenementen gevonden met deze filters.
        </div>
      )}
    </div>
  );
}

export default EventList;