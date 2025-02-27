
import React, { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchEventsByRadius } from "@/lib/api";
import { Event } from "@shared/schema";
import EventCard from "./EventCard";
import { Button } from "@/components/ui/button";
import { useLocation } from "@/hooks/useLocation";
import { Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface EventListProps {
  categoryFilter?: string;
  subcategoryFilter?: string;
  filters?: any;
  sortBy?: string;
  sortAscending?: boolean;
}

// Helper functie om afstand tussen twee coördinaten te berekenen
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Straal van de aarde in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c * 10) / 10; // Afgerond op 1 decimaal
}

function EventList({ categoryFilter, subcategoryFilter, filters = {}, sortBy = "distance", sortAscending = true }: EventListProps) {
  const { location, radius } = useLocation();
  const [filteredEvents, setFilteredEvents] = useState<Array<Event & { distance?: number }>>([]);

  const { data: events, isLoading, isError } = useQuery<Event[]>({
    queryKey: ["/api/events/nearby", location?.lat, location?.lng, radius],
    queryFn: async () => {
      if (!location) return [];
      console.log(`Fetching events with params: lat=${location.lat}&lng=${location.lng}&radius=${radius}`);
      return fetchEventsByRadius(location.lat, location.lng, radius);
    },
    enabled: !!location,
  });

  useEffect(() => {
    if (!events || !location) return;

    // Bereken afstand voor elk evenement en pas filters toe
    const eventsWithDistance = events.map(event => {
      const eventLat = event.latitude || (event.location?.lat || 0);
      const eventLng = event.longitude || (event.location?.lng || 0);
      const distance = calculateDistance(
        location.lat,
        location.lng,
        eventLat,
        eventLng
      );
      
      return {
        ...event,
        distance
      };
    });

    let filtered = [...eventsWithDistance];

    // Pas category filter toe
    if (categoryFilter) {
      filtered = filtered.filter(event => event.category === categoryFilter);
    }

    // Pas subcategory filter toe
    if (subcategoryFilter) {
      filtered = filtered.filter(event => event.subcategory === subcategoryFilter);
    }

    // Pas filters uit props toe als ze bestaan
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(event => 
        event.title.toLowerCase().includes(query) || 
        (event.description && event.description.toLowerCase().includes(query))
      );
    }

    if (filters.category) {
      filtered = filtered.filter(event => event.category === filters.category);
    }

    if (filters.showPaidEvents === false) {
      filtered = filtered.filter(event => !event.isPaid);
    }

    if (filters.useDistanceFilter && filters.distanceRadius) {
      filtered = filtered.filter(event => (event.distance || 0) <= filters.distanceRadius);
    }

    // Sorteer op basis van sortBy en sortAscending
    filtered.sort((a, b) => {
      if (sortBy === "distance") {
        return sortAscending 
          ? (a.distance || 0) - (b.distance || 0)
          : (b.distance || 0) - (a.distance || 0);
      } else if (sortBy === "date") {
        const dateA = new Date(a.startTime).getTime();
        const dateB = new Date(b.startTime).getTime();
        return sortAscending ? dateA - dateB : dateB - dateA;
      }
      return 0;
    });

    if (filtered.length === 0) {
      console.log("Geen evenementen gevonden met deze filters.");
    } else {
      console.log(`${filtered.length} evenementen gevonden, gesorteerd op ${sortBy}`);
    }

    setFilteredEvents(filtered);
  }, [events, categoryFilter, subcategoryFilter, location, filters, sortBy, sortAscending]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-32 bg-muted rounded mt-4"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (isError) {
    return <div className="p-4 text-red-500">Er is een probleem opgetreden bij het laden van evenementen. Probeer het later opnieuw.</div>;
  }

  if (filteredEvents.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>Geen evenementen gevonden in de buurt.</p>
        <p>Probeer de zoekcriteria aan te passen of een grotere zoekafstand.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-auto max-h-[calc(100vh-16rem)]">
      {filteredEvents.map((event) => (
        <EventCard 
          key={event.id} 
          event={event} 
          distance={event.distance}
        />
      ))}
    </div>
  );
}

export default EventList;
