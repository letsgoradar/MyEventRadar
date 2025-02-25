import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";
import EventCard from "./EventCard";
import { Skeleton } from "@/components/ui/skeleton";

interface FilterProps {
  searchQuery: string;
  category: string;
  fromDate: Date;
  toDate: Date;
  showPaidEvents: boolean;
  useDistanceFilter: boolean;
  distanceRadius: number;
}

interface EventListProps {
  filters: FilterProps;
  sortBy: 'date' | 'distance';
  sortAscending: boolean;
}

// Calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default function EventList({ filters, sortBy, sortAscending }: EventListProps) {
  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events/nearby", filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: "51.7656", // Default to Oss
        lng: "5.5314",
        radius: filters.useDistanceFilter ? filters.distanceRadius.toString() : "10",
      });

      const response = await fetch(`/api/events/nearby?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      const data = await response.json();
      console.log('Fetched events:', data);
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  // Filter and sort events
  let filteredEvents = events?.filter(event => {
    const eventDate = new Date(event.startTime);
    const now = new Date();

    // Basic date filter - only future events
    if (eventDate <= now) return false;

    // Apply search filter
    if (filters.searchQuery && !event.title.toLowerCase().includes(filters.searchQuery.toLowerCase())) {
      return false;
    }

    // Apply category filter
    if (filters.category && event.category !== filters.category) {
      return false;
    }

    // Apply date range filter
    if (eventDate < filters.fromDate || eventDate > filters.toDate) {
      return false;
    }

    // Apply paid events filter
    if (filters.showPaidEvents && !event.isPaid) {
      return false;
    }

    // Apply distance filter if enabled
    if (filters.useDistanceFilter) {
      const distance = calculateDistance(
        51.7656, // Default user location (Oss)
        5.5314,
        Number(event.latitude),
        Number(event.longitude)
      );
      if (distance > filters.distanceRadius) {
        return false;
      }
    }

    return true;
  });

  // Sort events
  if (filteredEvents?.length) {
    filteredEvents = [...filteredEvents].sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'date') {
        comparison = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      } else {
        // Sort by distance
        const distanceA = calculateDistance(
          51.7656,
          5.5314,
          Number(a.latitude),
          Number(a.longitude)
        );
        const distanceB = calculateDistance(
          51.7656,
          5.5314,
          Number(b.latitude),
          Number(b.longitude)
        );
        comparison = distanceA - distanceB;
      }

      return sortAscending ? comparison : -comparison;
    });
  }

  if (!filteredEvents?.length) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No events found</p>
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