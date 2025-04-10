import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import EventCard from "@/components/Events/EventCard"
import type { Event } from "@shared/schema"

interface EventListProps {
  searchQuery: string;
  radius: number;
  filteredEvents: Event[];
}

export function EventList({ filteredEvents }: EventListProps) {
  if (!filteredEvents.length) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Geen evenementen gevonden binnen de huidige filters.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
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