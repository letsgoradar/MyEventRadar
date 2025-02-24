import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import type { Event } from "@shared/schema"

export function EventList() {
  const { data: events, isLoading, error } = useQuery<Event[]>({
    queryKey: ['/api/events/nearby'],
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: '37.7749', // Default to San Francisco
        lng: '-122.4194',
        radius: '10'
      });
      const response = await fetch(`/api/events/nearby?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      return response.json();
    }
  })

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-3 bg-muted rounded w-1/2 mt-2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-3 bg-muted rounded w-full mt-2"></div>
              <div className="h-3 bg-muted rounded w-3/4 mt-2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-500">Error loading events. Please try again.</div>;
  }

  if (!events?.length) {
    return <div className="p-4">No events found in this area.</div>;
  }

  return (
    <div className="p-4 space-y-4 overflow-auto max-h-[calc(100vh-16rem)]">
      {events.map((event) => {
        const location = event.location as { lat: number; lng: number; address?: string };
        const locationText = location.address || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;

        return (
          <Card key={event.id}>
            <CardHeader>
              <CardTitle>{event.title}</CardTitle>
              <CardDescription>{event.category}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{event.description}</p>
              <div className="mt-2 text-sm text-muted-foreground">
                <p>{locationText}</p>
                <p>{format(new Date(event.startTime), 'PPP')}</p>
                {event.isPaid && event.price && <p>Price: ${event.price}</p>}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  )
}