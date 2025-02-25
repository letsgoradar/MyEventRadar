import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";
import EventCard from "./EventCard";
import { Skeleton } from "@/components/ui/skeleton";

interface EventListProps {
  location: { lat: number; lng: number };
  radius: number;
}

export default function EventList({ location, radius }: EventListProps) {
  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events/nearby", location.lat, location.lng, radius],
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (!events?.length) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No events found in this area</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}