import * as React from "react";
import MapView from "@/components/Map/MapView";
import { EventList } from "@/components/EventList";
import { EventDetailPanel } from "./EventDetailPanel";
import { EventPreview } from "./EventPreview";
import { EventInterface as Event } from "@shared/schema";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { startOfDay } from "date-fns";
import L from "leaflet";

interface SplitViewProps {
  searchQuery: string;
  filteredEvents: Event[];
  onFilteredEventsChange?: (events: Event[]) => void;
  onEventClick?: (event: Event) => void;
  selectedDays?: Date[];
}

export function SplitView({ 
  searchQuery, 
  filteredEvents, 
  onFilteredEventsChange,
  onEventClick,
  selectedDays: propSelectedDays
}: SplitViewProps) {
  const [activeEventId, setActiveEventId] = React.useState<number | null>(null);
  const [selectedEvent, setSelectedEvent] = React.useState<Event | null>(null);
  const [mapBounds, setMapBounds] = React.useState<L.LatLngBounds | null>(null);
  const [mapZoom, setMapZoom] = React.useState<number>(13);
  const [visibleEvents, setVisibleEvents] = React.useState<Event[]>(filteredEvents);
  const [showExpiredEvents, setShowExpiredEvents] = React.useState<boolean>(false);
  const [hoveredEventId, setHoveredEventId] = React.useState<number | null>(null);
  
  // Dispatch custom event voor hover synchronisatie met MapView (voorkomt re-render cycle)
  React.useEffect(() => {
    const event = new CustomEvent('eventHover', { detail: { eventId: hoveredEventId } });
    window.dispatchEvent(event);
  }, [hoveredEventId]);
  
  // Gebruik prop selectedDays als beschikbaar, anders lege array
  const selectedDays = propSelectedDays ?? [];
  
  // Controleer of een event is verlopen
  const isEventExpired = (event: Event): boolean => {
    return new Date(event.endTime || event.startTime) < new Date();
  };
  
  // Filter events op basis van de huidige kaartgrenzen, datum selectie en verlopen events status
  React.useEffect(() => {
    if (!filteredEvents) {
      setVisibleEvents([]);
      return;
    }
    
    // Basis filtering op verlopen events
    const nonExpiredEvents = showExpiredEvents ? 
      filteredEvents : 
      filteredEvents.filter(event => !isEventExpired(event));
    
    // Als er geen mapBounds zijn, toon alleen gefilterd op verlopen status
    if (!mapBounds) {
      setVisibleEvents(nonExpiredEvents);
      return;
    }
    
    // Filter events die binnen de huidige kaartgrenzen vallen
    let eventsInBounds = nonExpiredEvents.filter(event => {
      // Filter op kaartgrenzen
      const eventLatLng = L.latLng(Number(event.latitude), Number(event.longitude));
      return mapBounds.contains(eventLatLng);
    });
    
    // Filter op geselecteerde dagen (als er dagen zijn geselecteerd)
    if (selectedDays.length > 0) {
      eventsInBounds = eventsInBounds.filter(event => {
        const eventStart = startOfDay(new Date(event.startTime));
        const eventEnd = startOfDay(new Date(event.endTime || event.startTime));
        
        // Check of het event op een van de geselecteerde dagen valt
        return selectedDays.some(selectedDay => {
          const selected = startOfDay(selectedDay);
          return (eventStart <= selected && eventEnd >= selected) || 
                 (eventStart.getTime() === selected.getTime());
        });
      });
    }
    
    setVisibleEvents(eventsInBounds);
  }, [filteredEvents, mapBounds, showExpiredEvents, selectedDays]);

  // Nieuwe states voor kaart preview mode vs detail mode
  const [isPreviewMode, setIsPreviewMode] = React.useState<boolean>(false);
  const [previewEvent, setPreviewEvent] = React.useState<Event | null>(null);

  const handleMapEventClick = React.useCallback((event: Event) => {
    // Bij kaart klik: direct detail mode (net als tegels)
    setActiveEventId(event.id);
    setSelectedEvent(event);
    setIsPreviewMode(false);
    setPreviewEvent(null);
    onEventClick?.(event);
  }, [onEventClick]);

  const handleTileEventClick = React.useCallback((event: Event) => {
    // Bij tegel klik: direct detail mode
    setActiveEventId(event.id);
    setSelectedEvent(event);
    setIsPreviewMode(false);
    setPreviewEvent(null);
    onEventClick?.(event);
  }, [onEventClick]);

  const handleViewDetails = React.useCallback(() => {
    // Van preview naar detail mode
    if (previewEvent) {
      setSelectedEvent(previewEvent);
      setIsPreviewMode(false);
      setPreviewEvent(null);
    }
  }, [previewEvent]);

  const handleCloseEventDetail = React.useCallback(() => {
    setSelectedEvent(null);
    setActiveEventId(null);
    setIsPreviewMode(false);
    setPreviewEvent(null);
  }, []);

  const handleNavigateEvent = React.useCallback((direction: 'previous' | 'next') => {
    if (!selectedEvent) return;
    
    const currentIndex = filteredEvents.findIndex(e => e.id === selectedEvent.id);
    if (direction === 'previous' && currentIndex > 0) {
      const newEvent = filteredEvents[currentIndex - 1];
      setSelectedEvent(newEvent);
      setActiveEventId(newEvent.id);
    } else if (direction === 'next' && currentIndex < filteredEvents.length - 1) {
      const newEvent = filteredEvents[currentIndex + 1];
      setSelectedEvent(newEvent);
      setActiveEventId(newEvent.id);
    }
  }, [selectedEvent, filteredEvents]);

  const handleBoundsChange = React.useCallback((bounds: L.LatLngBounds) => {
    setMapBounds(bounds);
  }, []);
  
  const handleZoomChange = React.useCallback((zoom: number) => {
    setMapZoom(zoom);
  }, []);

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
                radius={50}
                filteredEvents={visibleEvents}
                onEventClick={handleMapEventClick}
                onBoundsChange={handleBoundsChange}
                onZoomChange={handleZoomChange}
                showExpiredEvents={showExpiredEvents}
                onShowExpiredEventsChange={(show) => setShowExpiredEvents(show)}
                hoveredEventId={hoveredEventId}
              />
              
            </div>
          </ResizablePanel>
          
          {/* Scheidingshandvat */}
          <ResizableHandle withHandle className="z-50 bg-primary" />
          
          {/* Rechter paneel: lijst/grid weergave of event detail */}
          <ResizablePanel defaultSize={50} minSize={35} className="relative">
            {selectedEvent ? (
              /* Event Detail Panel */
              <EventDetailPanel
                event={selectedEvent}
                events={filteredEvents}
                onClose={handleCloseEventDetail}
                onPrevious={() => handleNavigateEvent('previous')}
                onNext={() => handleNavigateEvent('next')}
              />
            ) : (
              /* Event List/Grid View with optional preview */
              <div className="h-full overflow-y-auto pb-20 px-4 relative">
                {/* Toon het aantal resultaten binnen het zichtbare gebied */}
                <div className="sticky top-0 pt-4 pb-3 bg-background z-10 mb-2 flex justify-between items-center">
                  <div className="text-lg font-medium">
                    {visibleEvents.length} {visibleEvents.length === 1 ? 'evenement' : 'evenementen'} in huidige zoekgebied
                  </div>
                  <div className="text-sm text-muted-foreground hidden sm:block">
                    Zoom in/uit op de kaart om resultaten aan te passen
                  </div>
                </div>
                
                <EventList 
                  searchQuery={searchQuery} 
                  radius={50} 
                  filteredEvents={visibleEvents} 
                  gridView={true}
                  onEventClick={handleTileEventClick}
                  onEventHover={setHoveredEventId}
                  hoveredEventId={hoveredEventId}
                />
                

              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

export default SplitView;