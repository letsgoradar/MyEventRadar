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
  sortBy?: "date" | "distance" | "popularity";
  sortAscending?: boolean;
}

export default function EventList({ 
  filters = {}, 
  sortBy = "date", 
  sortAscending = true 
}: EventListProps) {
  const { userLocation } = useLocation();
  const radius = filters?.distanceRadius || 10; // Default to 10km radius if not specified

  const { data: events, isLoading, isError } = useQuery<Event[]>({
    queryKey: ["/api/events/nearby", userLocation[0], userLocation[1], radius],
    enabled: !!userLocation,
  });

  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);

  useEffect(() => {
    console.log("Debug - Fetched events:", events);

    if (!events) {
      setFilteredEvents([]);
      return;
    }

    let filtered = [...events];

    // Apply filters
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(event => 
        event.title.toLowerCase().includes(query) || 
        event.description.toLowerCase().includes(query)
      );
    }

    if (filters.category && filters.category !== "all") {
      filtered = filtered.filter(event => event.category === filters.category);
    }

    if (filters.fromDate) {
      filtered = filtered.filter(event => 
        new Date(event.startTime) >= filters.fromDate!
      );
    }

    if (filters.toDate) {
      filtered = filtered.filter(event => 
        new Date(event.startTime) <= filters.toDate!
      );
    }

    if (filters.showPaidEvents === false) {
      filtered = filtered.filter(event => !event.isPaid);
    }

    console.log("Debug - Filtered events:", filtered.length, "events");
    setFilteredEvents(filtered);
  }, [events, filters]);

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

  if (filteredEvents.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        Geen evenementen gevonden.
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