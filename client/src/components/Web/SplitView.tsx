import * as React from "react";
import MapView from "@/components/Map/MapView";
import { EventList } from "@/components/EventList";
import { EventDetailPanel } from "./EventDetailPanel";
import { EventPreview } from "./EventPreview";
import { Event } from "@shared/schema";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import L from "leaflet";

interface SplitViewProps {
  searchQuery: string;
  radius: number;
  filteredEvents: Event[];
  onRadiusChange?: (radius: number) => void;
  onFilteredEventsChange?: (events: Event[]) => void;
  onEventClick?: (event: Event) => void;
}

export function SplitView({ 
  searchQuery, 
  radius, 
  filteredEvents, 
  onRadiusChange,
  onFilteredEventsChange,
  onEventClick
}: SplitViewProps) {
  const [activeEventId, setActiveEventId] = React.useState<number | null>(null);
  const [selectedEvent, setSelectedEvent] = React.useState<Event | null>(null);
  const [mapBounds, setMapBounds] = React.useState<L.LatLngBounds | null>(null);
  const [mapZoom, setMapZoom] = React.useState<number>(13);
  const [visibleEvents, setVisibleEvents] = React.useState<Event[]>(filteredEvents);
  const [showExpiredEvents, setShowExpiredEvents] = React.useState<boolean>(false);
  
  // Controleer of een event is verlopen
  const isEventExpired = (event: Event): boolean => {
    return new Date(event.endTime || event.startTime) < new Date();
  };
  
  // Filter events op basis van de huidige kaartgrenzen en verlopen events status
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
    const eventsInBounds = nonExpiredEvents.filter(event => {
      // Filter op kaartgrenzen
      const eventLatLng = L.latLng(Number(event.latitude), Number(event.longitude));
      return mapBounds.contains(eventLatLng);
    });
    
    setVisibleEvents(eventsInBounds);
  }, [filteredEvents, mapBounds, showExpiredEvents]);

  // Nieuwe states voor kaart preview mode vs detail mode
  const [isPreviewMode, setIsPreviewMode] = React.useState<boolean>(false);
  const [previewEvent, setPreviewEvent] = React.useState<Event | null>(null);

  const handleMapEventClick = React.useCallback((event: Event) => {
    // Bij kaart klik: eerst preview mode
    setActiveEventId(event.id);
    setPreviewEvent(event);
    setIsPreviewMode(true);
    // Nog geen selectedEvent zodat de tegels zichtbaar blijven
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
                onEventClick={handleMapEventClick}
                onRadiusChange={handleRadiusChange}
                onBoundsChange={handleBoundsChange}
                onZoomChange={handleZoomChange}
                showExpiredEvents={showExpiredEvents}
                onShowExpiredEventsChange={(show) => setShowExpiredEvents(show)}
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
                  <div className="flex items-center gap-2">
                    {/* Toon verlopen events toggle */}
                    <Button 
                      size="sm" 
                      variant={showExpiredEvents ? "default" : "outline"}
                      className="flex items-center gap-1 text-xs"
                      title="Toon verlopen events"
                      onClick={() => setShowExpiredEvents(!showExpiredEvents)}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      <span>Verlopen</span>
                    </Button>
                    <div className="text-sm text-muted-foreground hidden sm:block">
                      Zoom in/uit op de kaart om resultaten aan te passen
                    </div>
                  </div>
                </div>
                
                <EventList 
                  searchQuery={searchQuery} 
                  radius={radius} 
                  filteredEvents={visibleEvents} 
                  gridView={true} // Gebruik de nieuwe grid weergave
                  onEventClick={handleTileEventClick}
                />
                
                {/* Event Preview Overlay - toont wanneer er op kaart wordt geklikt */}
                {isPreviewMode && previewEvent && (
                  <div className="absolute top-0 left-0 w-full z-10">
                    <EventPreview
                      event={previewEvent}
                      onViewDetails={handleViewDetails}
                      onClose={handleCloseEventDetail}
                    />
                  </div>
                )}
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

export default SplitView;