import * as React from "react";
import MapView from "@/components/Map/MapView";
import { EventList } from "@/components/EventList";
import { Event } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@/hooks/useLocation";
import { fetchEventsByRadius } from "@/lib/api";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

interface SplitViewProps {
  searchQuery: string;
  radius: number;
  filteredEvents: Event[];
  onRadiusChange?: (radius: number) => void;
  onFilteredEventsChange?: (events: Event[]) => void;
}

export function SplitView({ 
  searchQuery, 
  radius, 
  filteredEvents, 
  onRadiusChange,
  onFilteredEventsChange 
}: SplitViewProps) {
  const { location, isLoadingLocation } = useLocation();
  const [activeEventId, setActiveEventId] = React.useState<number | null>(null);

  // Query events
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events", location?.lat, location?.lng, radius],
    queryFn: () => 
      location 
        ? fetchEventsByRadius(location.lat, location.lng, radius) 
        : Promise.resolve([]),
    enabled: !!location,
  });

  // Apply filters (search)
  React.useEffect(() => {
    // Filter events based on search query
    const filtered = events.filter(event => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        event.title.toLowerCase().includes(query) ||
        (event.description && event.description.toLowerCase().includes(query)) ||
        (event.location && event.location.toLowerCase().includes(query)) ||
        (event.category && event.category.toLowerCase().includes(query))
      );
    });

    // Sort by distance
    const sorted = [...filtered].sort((a, b) => {
      return (a.distance || Infinity) - (b.distance || Infinity);
    });

    // Update filtered events
    onFilteredEventsChange?.(sorted);
  }, [events, searchQuery, onFilteredEventsChange]);

  // Event click handlers
  const handleEventClick = (event: Event) => {
    setActiveEventId(event.id);
  };

  const handleRadiusChange = (newRadius: number) => {
    onRadiusChange?.(newRadius);
  };

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      <ResizablePanel defaultSize={60} minSize={30}>
        <div className="h-full">
          <MapView 
            searchQuery={searchQuery} 
            radius={radius} 
            filteredEvents={filteredEvents}
            onEventClick={handleEventClick}
            onRadiusChange={handleRadiusChange}
          />
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={40} minSize={30}>
        <div className="h-full overflow-auto">
          <EventList 
            searchQuery={searchQuery} 
            radius={radius} 
            filteredEvents={filteredEvents} 
          />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export default SplitView;