import * as React from "react";
import MapView from "@/components/Map/MapView";
import { EventList } from "@/components/EventList";
import { Event } from "@shared/schema";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { motion, AnimatePresence } from "framer-motion";
import L from "leaflet";

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
  const [mapBounds, setMapBounds] = React.useState<L.LatLngBounds | null>(null);
  const [mapZoom, setMapZoom] = React.useState<number>(13);
  const [visibleEvents, setVisibleEvents] = React.useState<Event[]>(filteredEvents);
  
  // Filter events op basis van de huidige kaartgrenzen
  React.useEffect(() => {
    if (!mapBounds || !filteredEvents) {
      setVisibleEvents(filteredEvents);
      return;
    }
    
    // Filter events die binnen de huidige kaartgrenzen vallen
    const eventsInBounds = filteredEvents.filter(event => {
      const eventLatLng = L.latLng(Number(event.latitude), Number(event.longitude));
      return mapBounds.contains(eventLatLng);
    });
    
    setVisibleEvents(eventsInBounds);
  }, [filteredEvents, mapBounds]);

  const handleEventClick = React.useCallback((event: Event) => {
    setActiveEventId(event.id);
  }, []);

  const handleRadiusChange = React.useCallback((newRadius: number) => {
    onRadiusChange?.(newRadius);
  }, [onRadiusChange]);
  
  const handleBoundsChange = React.useCallback((bounds: L.LatLngBounds) => {
    setMapBounds(bounds);
  }, []);
  
  const handleZoomChange = React.useCallback((zoom: number) => {
    setMapZoom(zoom);
    
    // Bereken een radius op basis van het zoom niveau
    const calculatedRadius = Math.max(5, Math.round(20 / (zoom * 0.4)));
    onRadiusChange?.(calculatedRadius);
  }, [onRadiusChange]);

  return (
    <div className="flex flex-col h-full">
      {/* Voeg een horizontale scheidingslijn toe tussen header en content */}
      <div className="w-full h-[1px] bg-border"></div>
      
      {/* Content container met absolute positionering binnen de parent div */}
      <div className="flex-1 relative">
        <ResizablePanelGroup direction="horizontal" className="h-full absolute inset-0">
          {/* Linker paneel: kaartweergave */}
          <ResizablePanel defaultSize={50} minSize={30} className="relative">
            <div className="h-full overflow-hidden">
              <MapView 
                searchQuery={searchQuery} 
                radius={radius} 
                filteredEvents={filteredEvents}
                onEventClick={handleEventClick}
                onRadiusChange={handleRadiusChange}
                onBoundsChange={handleBoundsChange}
                onZoomChange={handleZoomChange}
              />
            </div>
          </ResizablePanel>
          
          {/* Scheidingshandvat */}
          <ResizableHandle withHandle className="z-50 bg-primary" />
          
          {/* Rechter paneel: lijst/grid weergave */}
          <ResizablePanel defaultSize={50} minSize={30} className="relative">
            <div className="h-full overflow-y-auto pb-20 px-4">
              {/* Toon het aantal resultaten binnen het zichtbare gebied */}
              <div className="sticky top-0 pt-4 pb-3 bg-background z-10 mb-2 flex justify-between items-center">
                <div className="text-lg font-medium">
                  {visibleEvents.length} {visibleEvents.length === 1 ? 'evenement' : 'evenementen'} in huidige zoekgebied
                </div>
                <div className="text-sm text-muted-foreground">
                  Zoom in/uit op de kaart om resultaten aan te passen
                </div>
              </div>
              
              <EventList 
                searchQuery={searchQuery} 
                radius={radius} 
                filteredEvents={visibleEvents} 
                gridView={true} // Gebruik de nieuwe grid weergave
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

export default SplitView;