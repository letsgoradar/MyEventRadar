import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import EventCard from "@/components/Events/EventCard"
import { useIsMobile } from "@/hooks/use-mobile"
import { Toggle } from "@/components/ui/toggle"
import { CalendarX2, Clock, SortAsc } from "lucide-react"
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
  
  // Gebruik gridView in desktop, en ook in mobiel als gridView=true is meegegeven
  const useGridLayout = (!isMobile && gridView) || (isMobile && gridView);
  
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
  
  // Toon filters boven de lijst
  const renderFilterControls = () => (
    <div className="pb-4 flex justify-between items-center">
      <div className="flex items-center gap-2">
        <Toggle 
          variant="outline" 
          size="sm" 
          pressed={hideExpired}
          onPressedChange={setHideExpired}
          className="gap-1"
        >
          <CalendarX2 className="h-4 w-4" />
        </Toggle>
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <SortAsc className="h-4 w-4" />
            <span className="hidden sm:inline">Sorteren</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Sorteer op</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className={cn("cursor-pointer", sortOrder === "time" && "font-semibold")}
            onClick={() => setSortOrder("time")}
          >
            <Clock className="h-4 w-4 mr-2" />
            Tijd tot aanvang
          </DropdownMenuItem>
          <DropdownMenuItem
            className={cn("cursor-pointer", sortOrder === "distance" && "font-semibold")}
            onClick={() => setSortOrder("distance")}
          >
            <CalendarX2 className="h-4 w-4 mr-2" />
            Afstand
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
  
  if (!processedEvents.length) {
    return (
      <div className="p-4">
        {renderFilterControls()}
        <div className="text-center text-muted-foreground pt-8">
          Geen evenementen gevonden binnen de huidige filters.
        </div>
      </div>
    );
  }

  if (useGridLayout) {
    return (
      <div className="p-4 event-list-container">
        {renderFilterControls()}
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
    <div className="p-4 event-list-container">
      {renderFilterControls()}
      <div className="space-y-4 event-list-bg">
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