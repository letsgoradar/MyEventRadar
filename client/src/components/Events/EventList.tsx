import React, { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchEventsByRadius } from "@/lib/api";
import { Event } from "@shared/schema";
import EventCard from "./EventCard";
import { Button } from "@/components/ui/button";
import { useLocation } from "@/hooks/useLocation";
import { Filter } from "lucide-react";

interface EventListProps {
  categoryFilter?: string;
  subcategoryFilter?: string;
}

export function EventList({ categoryFilter, subcategoryFilter }: EventListProps) {
  const { location, radius } = useLocation();
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);

  const { data: events, isLoading, isError } = useQuery<Event[]>({
    queryKey: ["/api/events/nearby", location?.lat, location?.lng, radius],
    queryFn: async () => {
      if (!location) return [];
      console.log(`Fetching events with params: lat=${location.lat}&lng=${location.lng}&radius=${radius}`);
      return fetchEventsByRadius(location.lat, location.lng, radius);
    },
    enabled: !!location,
  });

  // Alleen filteren wanneer events of filters veranderen
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
    setFilteredEvents(filtered);
  }, [events, categoryFilter, subcategoryFilter]);

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-500">
        Evenementen laden...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 text-center text-red-500">
        Er is een fout opgetreden bij het laden van evenementen.
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        Geen evenementen gevonden in de buurt. Probeer de zoekcriteria aan te passen of een grotere zoekafstand.
      </div>
    );
  }

  if (filteredEvents.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        Geen evenementen gevonden met deze filters. Probeer andere filtercriteria.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-auto max-h-[calc(100vh-16rem)]">
      {filteredEvents.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}