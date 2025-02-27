import React, { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchEventsByRadius } from "@/lib/api";
import { Event } from "@shared/schema";
import EventCard from "./EventCard";
import { Button } from "@/components/ui/button";
import { useLocation } from "@/hooks/useLocation";

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

function EventList() {
  const { location } = useLocation();
  const [radius, setRadius] = useState(5);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [subcategoryFilter, setSubcategoryFilter] = useState<string | null>(null);
  const [filteredEvents, setFilteredEvents] = useState<Array<Event & { distance: number }>>([]);

  const { data: events, isLoading, isError } = useQuery({
    queryKey: ["events", location?.lat, location?.lng, radius],
    queryFn: async () => {
      if (!location) return [];
      console.log(`Fetching events with params: lat=${location.lat}&lng=${location.lng}&radius=${radius}`);
      return fetchEventsByRadius(location.lat, location.lng, radius);
    },
    enabled: !!location,
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

    // Apply filters
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
    return <div className="p-4 text-center">Evenementen laden...</div>;
  }

  if (isError) {
    return (
      <div className="p-4 text-center text-red-500">
        Er is een fout opgetreden bij het ophalen van evenementen.
      </div>
    );
  }

  if (filteredEvents.length === 0) {
    return (
      <div className="p-4 flex flex-col items-center">
        <p className="mb-4 text-center">
          Geen evenementen gevonden in de buurt. Probeer de zoekcriteria aan te passen of een grotere zoekafstand.
        </p>
        <Button onClick={incrementRadius}>
          Zoekbereik vergroten ({radius} km → {radius + 5} km)
        </Button>
      </div>
    );
  }

  return (
    <div className="p-2 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {filteredEvents.map((event) => (
        <EventCard 
          key={event.id} 
          event={event} 
          distance={event.distance}
        />
      ))}
      <div className="col-span-full flex justify-center mt-4">
        <Button onClick={incrementRadius}>
          Meer evenementen laden ({radius} km → {radius + 5} km)
        </Button>
      </div>
    </div>
  );
}

export default EventList;