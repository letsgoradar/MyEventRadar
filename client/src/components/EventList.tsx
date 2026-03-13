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
import { PromotedEventsCarousel } from "@/components/Ads/PromotedEventsCarousel"

// Uitgebreide Event interface met distance property
interface EventWithDistance extends EventInterface {
  distance?: number;
}

interface EventListProps {
  searchQuery: string;
  radius: number;
  filteredEvents: EventWithDistance[];
  gridView?: boolean;
  onEventClick?: (event: EventWithDistance) => void;
  onEventHover?: (eventId: number | null) => void;
  hoveredEventId?: number | null;
  isHidden?: (eventId: number) => boolean;
  onHideToggle?: (eventId: number) => void;
}

const INITIAL_DISPLAY_COUNT = 24;
const LOAD_MORE_COUNT = 24;

export function EventList({ filteredEvents, gridView = false, onEventClick, onEventHover, hoveredEventId, isHidden, onHideToggle }: EventListProps) {
  const isMobile = useIsMobile();
  const [displayCount, setDisplayCount] = React.useState(INITIAL_DISPLAY_COUNT);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  
  React.useEffect(() => {
    setDisplayCount(INITIAL_DISPLAY_COUNT);
  }, [filteredEvents]);

  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayCount(prev => Math.min(prev + LOAD_MORE_COUNT, filteredEvents.length));
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredEvents.length]);
  
  const isAppView = window.location.pathname.includes('/app');
  const useGridLayout = isAppView || (!isMobile && gridView) || (isMobile && gridView);
  
  const processedEvents = filteredEvents;
  const displayedEvents = processedEvents.slice(0, displayCount);
  const hasMore = displayCount < processedEvents.length;
  
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
        <PromotedEventsCarousel
          onEventClick={onEventClick}
          onEventHover={onEventHover}
          hoveredEventId={hoveredEventId}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr event-list-bg">
          {displayedEvents.map((event) => (
            <div
              key={event.id}
              onMouseEnter={() => onEventHover?.(event.id)}
              onMouseLeave={() => onEventHover?.(null)}
            >
              <EventCard 
                event={event} 
                distance={event.distance}
                gridView={true}
                onEventClick={onEventClick}
                isHighlighted={hoveredEventId === event.id}
                isHidden={isHidden?.(event.id)}
                onHideToggle={onHideToggle}
              />
            </div>
          ))}
        </div>
        {hasMore && <div ref={sentinelRef} className="h-8" />}
      </div>
    );
  }

  // Standaard lijstweergave
  return (
    <div className="px-4 pt-2 pb-4 event-list-container">
      <PromotedEventsCarousel
        onEventClick={onEventClick}
        onEventHover={onEventHover}
        hoveredEventId={hoveredEventId}
      />
      <div className="space-y-3 event-list-bg">
        {displayedEvents.map((event) => (
          <div
            key={event.id}
            onMouseEnter={() => onEventHover?.(event.id)}
            onMouseLeave={() => onEventHover?.(null)}
          >
            <EventCard 
              event={event} 
              distance={event.distance}
              gridView={false}
              onEventClick={onEventClick}
              isHighlighted={hoveredEventId === event.id}
              isHidden={isHidden?.(event.id)}
              onHideToggle={onHideToggle}
            />
          </div>
        ))}
      </div>
      {hasMore && <div ref={sentinelRef} className="h-8" />}
    </div>
  );
}