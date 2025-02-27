import React, { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchEventsByRadius } from "@/lib/api";
import { Event } from "@shared/schema";
import EventCard from "./EventCard";
import { Button } from "@/components/ui/button";
import { useLocation } from "@/hooks/useLocation";
import CategoryPicker from "@/components/CategoryPicker";

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

function EventList() {
  const { location } = useLocation();
  const [radius, setRadius] = useState<number>(5);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [subcategoryFilter, setSubcategoryFilter] = useState<string | null>(null);
  const [filteredEvents, setFilteredEvents] = useState<(Event & { distance?: number })[]>([]);

  // Fetch events from API
  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ["events", location, radius],
    queryFn: async () => {
      if (!location) return [];
      console.log(`Fetching events with params: lat=${location.lat}&lng=${location.lng}&radius=${radius}`);
      const fetchedEvents = await fetchEventsByRadius(location.lat, location.lng, radius);

      // Calculate distance for each event and sort by distance
      return fetchedEvents.map((event: Event) => ({
        ...event,
        distance: calculateDistance(location.lat, location.lng, event.latitude, event.longitude)
      })).sort((a, b) => (a.distance || 0) - (b.distance || 0));
    },
    enabled: !!location,
  });

  // Filter events based on category and subcategory
  useEffect(() => {
    if (!events) return;

    console.log("Debug - Fetched events:", events);

    let filtered = [...events];

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
  }, [events, categoryFilter, subcategoryFilter]);

  // Handle radius change
  const increaseRadius = () => {
    setRadius(prevRadius => prevRadius + 5);
  };

  if (isLoading) return <div className="p-4">Evenementen laden...</div>;
  if (error) return <div className="p-4">Er is een fout opgetreden bij het laden van evenementen.</div>;
  if (!location) return <div className="p-4">Locatie wordt bepaald...</div>;

  return (
    <div className="p-4">
      <div className="mb-4">
        <CategoryPicker
          onCategoryChange={setCategoryFilter}
          onSubcategoryChange={setSubcategoryFilter}
        />
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Evenementen binnen {radius} km</h2>
          <Button onClick={increaseRadius} variant="outline" size="sm">
            Zoekafstand vergroten
          </Button>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="p-4 text-center bg-muted rounded-lg">
          Geen evenementen gevonden in de buurt. Probeer de zoekcriteria aan te passen of een grotere zoekafstand.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map(event => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

export default EventList;