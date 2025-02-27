
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import type { Event } from "@shared/schema";
import EventCard from "./EventCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "@/hooks/useLocation";

interface FilterProps {
  searchQuery?: string;
  category?: string;
  fromDate?: Date | null;  
  toDate?: Date | null;    
  showPaidEvents?: boolean;
  useDistanceFilter?: boolean;
  distanceRadius?: number;
}

interface EventListProps {
  filters?: FilterProps;
  sortBy?: "date" | "distance" | "price";
  sortAscending?: boolean;
}

export default function EventList({ 
  filters = {}, 
  sortBy = "date", 
  sortAscending = true 
}: EventListProps) {
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const { userLocation } = useLocation();
  
  // Default radius is 10 km if not specified in filters
  const radius = filters.distanceRadius || 10;

  const { data: events = [], isLoading, isError } = useQuery<Event[]>({
    queryKey: ['events', userLocation, radius],
    queryFn: async () => {
      if (!userLocation || userLocation.length !== 2) {
        return [];
      }
      
      const params = new URLSearchParams({
        lat: userLocation[0].toString(),
        lng: userLocation[1].toString(),
        radius: radius.toString()
      });
      
      console.log(`Fetching events with params: ${params.toString()}`);
      const response = await fetch(`/api/events/nearby?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      
      const data = await response.json();
      console.log("Debug - Fetched events:", data);
      return data;
    },
    enabled: userLocation !== null && userLocation.length === 2
  });

  // Apply filters and sorting to events
  useEffect(() => {
    if (!events || events.length === 0) {
      setFilteredEvents([]);
      return;
    }

    let filtered = [...events];
    
    // Apply search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(event => 
        event.title.toLowerCase().includes(query) || 
        (event.description && event.description.toLowerCase().includes(query))
      );
    }
    
    // Apply category filter
    if (filters.category) {
      filtered = filtered.filter(event => event.category === filters.category);
    }
    
    // Apply date filters
    if (filters.fromDate) {
      filtered = filtered.filter(event => new Date(event.startTime) >= filters.fromDate!);
    }
    
    if (filters.toDate) {
      filtered = filtered.filter(event => new Date(event.startTime) <= filters.toDate!);
    }
    
    // Apply paid events filter
    if (filters.showPaidEvents === false) {
      filtered = filtered.filter(event => !event.isPaid);
    }

    // Sort events
    if (sortBy === "date") {
      filtered.sort((a, b) => {
        const dateA = new Date(a.startTime).getTime();
        const dateB = new Date(b.startTime).getTime();
        return sortAscending ? dateA - dateB : dateB - dateA;
      });
    } else if (sortBy === "distance" && userLocation) {
      // Sort by distance - simplified calculation for demo
      filtered.sort((a, b) => {
        const distA = Math.sqrt(
          Math.pow(a.latitude - userLocation[0], 2) + 
          Math.pow(a.longitude - userLocation[1], 2)
        );
        const distB = Math.sqrt(
          Math.pow(b.latitude - userLocation[0], 2) + 
          Math.pow(b.longitude - userLocation[1], 2)
        );
        return sortAscending ? distA - distB : distB - distA;
      });
    } else if (sortBy === "price") {
      filtered.sort((a, b) => {
        const priceA = a.price ? parseFloat(a.price) : 0;
        const priceB = b.price ? parseFloat(b.price) : 0;
        return sortAscending ? priceA - priceB : priceB - priceA;
      });
    }

    console.log("Debug - Filtered events:", filtered.length, "events");
    setFilteredEvents(filtered);
  }, [events, filters, sortBy, sortAscending, userLocation]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg overflow-hidden">
            <Skeleton className="h-[200px] w-full" />
          </div>
        ))}
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
