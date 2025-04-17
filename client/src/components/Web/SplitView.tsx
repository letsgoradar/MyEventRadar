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
    <div className="h-full">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Linker paneel: kaartweergave */}
        <ResizablePanel defaultSize={50} minSize={30} className="relative">
          <div className="h-full overflow-hidden">
            <MapView 
              searchQuery={searchQuery} 
              radius={radius} 
              filteredEvents={filteredEvents}
              onEventClick={handleEventClick}
              onRadiusChange={handleRadiusChange}
            />
          </div>
        </ResizablePanel>
        
        {/* Scheidingshandvat */}
        <ResizableHandle withHandle className="z-50 bg-primary" />
        
        {/* Rechter paneel: lijst/grid weergave */}
        <ResizablePanel defaultSize={50} minSize={30} className="relative">
          <div className="h-full overflow-y-auto pb-20 px-4 pt-4">
            <EventList 
              searchQuery={searchQuery} 
              radius={radius} 
              filteredEvents={filteredEvents} 
              gridView={true} // Gebruik de nieuwe grid weergave
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export default SplitView;