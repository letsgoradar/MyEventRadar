import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import EventCard from "@/components/Events/EventCard"
import { useIsMobile } from "@/hooks/use-mobile"
import type { Event } from "@shared/schema"

// Uitgebreide Event interface met distance property
interface EventWithDistance extends Event {
  distance?: number;
}

interface EventListProps {
  searchQuery: string;
  radius: number;
  filteredEvents: EventWithDistance[];
  gridView?: boolean;
}

export function EventList({ filteredEvents, gridView = false }: EventListProps) {
  const isMobile = useIsMobile();
  
  // Gebruik gridView alleen in de desktop versie, in mobile altijd de lijst
  const useGridLayout = !isMobile && gridView;
  
  if (!filteredEvents.length) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Geen evenementen gevonden binnen de huidige filters.
      </div>
    );
  }

  if (useGridLayout) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
          {filteredEvents.map((event) => (
            <EventCard 
              key={event.id} 
              event={event} 
              distance={event.distance}
              gridView={true}
            />
          ))}
        </div>
      </div>
    );
  }

  // Standaard lijstweergave
  return (
    <div className="p-4 space-y-4">
      {filteredEvents.map((event) => (
        <EventCard 
          key={event.id} 
          event={event} 
          distance={event.distance}
          gridView={false}
        />
      ))}
    </div>
  );
}