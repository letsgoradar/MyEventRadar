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
import { EventInterface, type events } from "@shared/schema"

// Uitgebreide Event interface met distance property
interface EventWithDistance extends EventInterface {
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
  
  // Check of we op de App pagina zijn
  const isAppView = window.location.pathname.includes('/app');
  
  // In App altijd tegels gebruiken, anders volg de gridView prop
  // Gebruik gridView in desktop, en ook in mobiel als gridView=true is meegegeven of in App
  const useGridLayout = isAppView || (!isMobile && gridView) || (isMobile && gridView);
  
  // BELANGRIJK: Alle filter- en sorteerfunctionaliteit is nu verplaatst naar AppLayout
  // EventList is alleen verantwoordelijk voor het weergeven van de gebeurtenissen
  
  // We gebruiken direct de filteredEvents die als prop worden doorgegeven
  // Sortering en filtering gebeurt nu in de parent component
  const processedEvents = filteredEvents;
  
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