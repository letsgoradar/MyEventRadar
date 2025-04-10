import * as React from "react";
import MapView from "@/components/Map/MapView";
import { EventList } from "@/components/EventList";
import { Event } from "@shared/schema";
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
  const [activeEventId, setActiveEventId] = React.useState<number | null>(null);

  const handleEventClick = React.useCallback((event: Event) => {
    setActiveEventId(event.id);
  }, []);

  const handleRadiusChange = React.useCallback((newRadius: number) => {
    onRadiusChange?.(newRadius);
  }, [onRadiusChange]);

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