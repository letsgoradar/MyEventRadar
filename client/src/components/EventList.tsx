import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import EventCard from "@/components/Events/EventCard"
import type { Event } from "@shared/schema"

interface EventListProps {
  searchQuery: string;
  radius: number;
  filteredEvents: Event[];
  onEventHover?: (eventId: number | null) => void;
  onEventClick?: (event: Event) => void;
}

export function EventList({ 
  filteredEvents, 
  onEventHover,
  onEventClick
}: EventListProps) {
  const [selectedEvent, setSelectedEvent] = React.useState<number | null>(null);

  // Handle event hover to highlight on map
  const handleEventHover = (eventId: number | null) => {
    setSelectedEvent(eventId);
    if (onEventHover) {
      onEventHover(eventId);
    }
  };

  // Handle event click
  const handleEventClick = (event: Event) => {
    setSelectedEvent(event.id);
    if (onEventClick) {
      onEventClick(event);
    }
  };

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
        <div
          key={event.id}
          onMouseEnter={() => handleEventHover(event.id)}
          onMouseLeave={() => handleEventHover(null)}
          onClick={() => handleEventClick(event)}
          className={`transition-transform duration-200 ${selectedEvent === event.id ? 'scale-[1.02]' : ''}`}
        >
          <EventCard 
            event={event} 
            distance={event.distance}
            isSelected={selectedEvent === event.id}
          />
        </div>
      ))}
    </div>
  );
}