import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";
import EventCard from "./EventCard";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isAfter, isSameDay } from "date-fns";

interface EventListProps {
  location: { lat: number; lng: number };
  radius: number;
  filters: Array<{ key: string; value: string }>;
}

export default function EventList({ location, radius, filters }: EventListProps) {
  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events/nearby", location.lat, location.lng, radius, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: location.lat.toString(),
        lng: location.lng.toString(),
        radius: radius.toString(),
      });
      const response = await fetch(`/api/events/nearby?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      return response.json();
    },
  });

  // Filter events based on active filters
  const filteredEvents = events?.filter(event => {
    return filters.every(filter => {
      switch (filter.key) {
        case 'search':
          return event.title.toLowerCase().includes(filter.value.toLowerCase()) ||
                 event.description.toLowerCase().includes(filter.value.toLowerCase());
        case 'category':
          return event.category === filter.value || event.subcategory === filter.value;
        case 'date': {
          const filterDate = new Date(filter.value);
          const eventDate = new Date(event.startTime);
          return isSameDay(filterDate, eventDate);
        }
        case 'paid':
          return event.isPaid === (filter.value === 'true');
        default:
          return true;
      }
    });
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (!filteredEvents?.length) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No events found matching your criteria</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {filteredEvents.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}