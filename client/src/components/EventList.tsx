import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import EventCard from "@/components/Events/EventCard"
import { useIsMobile } from "@/hooks/use-mobile"
import { Toggle } from "@/components/ui/toggle"
import { CalendarX2, Clock, SortAsc, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
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
  
  // State voor filters
  const [hideExpired, setHideExpired] = React.useState(true);
  const [sortOrder, setSortOrder] = React.useState<"time" | "distance">("time");
  
  // Check of we op de App2 pagina zijn
  const isApp2 = window.location.pathname.includes('/app2');
  
  // Check of we in kaart of lijst weergave zijn in App2
  const isApp2MapView = isApp2 && 
                        (window.location.pathname.includes('/map') || 
                         document.getElementById('map-container') !== null);
                         
  // In App2 altijd tegels gebruiken, anders volg de gridView prop
  // Gebruik gridView in desktop, en ook in mobiel als gridView=true is meegegeven of in App2
  const useGridLayout = isApp2 || (!isMobile && gridView) || (isMobile && gridView);
  
  // Geen aparte filtercontrol meer in EventList, deze verhuizen we naar App2Layout
      
  // Geen speciale behandeling meer voor kaartweergave, aangezien de sorteerknop naar App2Layout is verhuisd
  
  // Filter en sorteer de evenementen
  const processedEvents = React.useMemo(() => {
    // Filter verlopen evenementen indien nodig
    let events = [...filteredEvents];
    if (hideExpired) {
      const now = new Date();
      events = events.filter(event => {
        // Controleer of endTime een geldige waarde heeft
        if (!event.endTime) return true;
        return new Date(event.endTime) > now;
      });
    }
    
    // Sorteer evenementen
    if (sortOrder === "time") {
      events.sort((a, b) => {
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      });
    } else if (sortOrder === "distance" && events[0]?.distance !== undefined) {
      events.sort((a, b) => {
        return (a.distance || 0) - (b.distance || 0);
      });
    }
    
    return events;
  }, [filteredEvents, hideExpired, sortOrder]);
  
  if (!processedEvents.length) {
    return (
      <div className="p-4">
        <div className="text-center text-muted-foreground pt-8">
          Geen evenementen gevonden binnen de huidige filters.
        </div>
      </div>
    );
  }

  if (useGridLayout) {
    return (
      <div className="p-4 event-list-container">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr event-list-bg">
          {processedEvents.map((event) => (
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
    <div className="px-4 pt-2 pb-4 event-list-container">
      <div className="space-y-3 event-list-bg">
        {processedEvents.map((event) => (
          <EventCard 
            key={event.id} 
            event={event} 
            distance={event.distance}
            gridView={false}
          />
        ))}
      </div>
    </div>
  );
}