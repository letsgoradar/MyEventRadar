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
import { useLocation as useRouterLocation } from "wouter";
import { useLocation } from "@/hooks/useLocation";
import { MapPin, Clock, ChevronDown, Plus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SortOption = "time" | "distance";

// Functie om afstand te berekenen (Haversine formule)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}

interface EventWithDistance extends Event {
  distance?: number;
}

interface SplitViewProps {
  searchQuery: string;
  filteredEvents: Event[];
  onFilteredEventsChange?: (events: Event[]) => void;
  onEventClick?: (event: Event) => void;
  selectedDays?: Date[];
  onFilterSidebarOpen?: () => void;
}

export function SplitView({ 
  searchQuery, 
  filteredEvents, 
  onFilteredEventsChange,
  onEventClick,
  selectedDays: propSelectedDays,
  onFilterSidebarOpen
}: SplitViewProps) {
  const [, setRouterLocation] = useRouterLocation();
  const [activeEventId, setActiveEventId] = React.useState<number | null>(null);
  const [selectedEvent, setSelectedEvent] = React.useState<Event | null>(null);
  const [mapBounds, setMapBounds] = React.useState<L.LatLngBounds | null>(null);
  const [mapZoom, setMapZoom] = React.useState<number>(10);
  const [visibleEvents, setVisibleEvents] = React.useState<EventWithDistance[]>([]);
  const [showExpiredEvents, setShowExpiredEvents] = React.useState<boolean>(false);
  const [hoveredEventId, setHoveredEventId] = React.useState<number | null>(null);
  const [sortOption, setSortOption] = React.useState<SortOption>("time");
  const scrollPositionRef = React.useRef<number>(0);
  const listContainerRef = React.useRef<HTMLDivElement>(null);
  
  // Haal gebruikerslocatie op
  const { location } = useLocation();
  
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
  // En sorteer op afstand van gebruikerslocatie
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
    let eventsToProcess = nonExpiredEvents;
    
    if (mapBounds) {
      // Filter events die binnen de huidige kaartgrenzen vallen
      eventsToProcess = nonExpiredEvents.filter(event => {
        const eventLatLng = L.latLng(Number(event.latitude), Number(event.longitude));
        return mapBounds.contains(eventLatLng);
      });
    }
    
    // Filter op geselecteerde dagen (als er dagen zijn geselecteerd)
    if (selectedDays.length > 0) {
      eventsToProcess = eventsToProcess.filter(event => {
        const eventStart = startOfDay(new Date(event.startTime));
        const eventEnd = startOfDay(new Date(event.endTime || event.startTime));
        
        return selectedDays.some(selectedDay => {
          const selected = startOfDay(selectedDay);
          return (eventStart <= selected && eventEnd >= selected) || 
                 (eventStart.getTime() === selected.getTime());
        });
      });
    }
    
    // Bereken afstand voor elk event
    const eventsWithDistance: EventWithDistance[] = eventsToProcess.map(event => {
      const distance = location 
        ? calculateDistance(location.lat, location.lng, Number(event.latitude), Number(event.longitude))
        : undefined;
      return { ...event, distance };
    });
    
    // Helper: bereken effectieve duratie in dagen
    // Voor ongoing events: resterende duratie (end - now)
    // Voor toekomstige events: totale duratie
    const getEffectiveDurationDays = (event: Event): number => {
      const now = new Date();
      const start = new Date(event.startTime);
      const end = event.endTime ? new Date(event.endTime) : start;
      
      // Als event al begonnen is, gebruik resterende tijd
      if (start < now && end > now) {
        const remainingMs = end.getTime() - now.getTime();
        return Math.max(1, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
      }
      
      // Toekomstig event: totale duratie
      const diffMs = end.getTime() - start.getTime();
      return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    };
    
    // Sorteer op basis van geselecteerde optie
    if (sortOption === "time") {
      // Sorteer op dag eerst, dan op duratie (kort > lang), dan op afstand
      eventsWithDistance.sort((a, b) => {
        const now = startOfDay(new Date());
        const startA = startOfDay(new Date(a.startTime));
        const startB = startOfDay(new Date(b.startTime));
        
        // Gebruik effectieve dag: als event al begonnen is, gebruik vandaag
        const effectiveDayA = startA < now ? now : startA;
        const effectiveDayB = startB < now ? now : startB;
        
        // Als verschillende effectieve dagen: sorteer op dag
        if (effectiveDayA.getTime() !== effectiveDayB.getTime()) {
          return effectiveDayA.getTime() - effectiveDayB.getTime();
        }
        
        // Zelfde dag: korte events boven lange events (urgenter)
        const durationA = getEffectiveDurationDays(a);
        const durationB = getEffectiveDurationDays(b);
        if (durationA !== durationB) {
          return durationA - durationB; // Kortere duratie eerst
        }
        
        // Zelfde duratie: sorteer op afstand (dichtst bij eerst)
        if (a.distance === undefined && b.distance === undefined) return 0;
        if (a.distance === undefined) return 1;
        if (b.distance === undefined) return -1;
        return a.distance - b.distance;
      });
    } else {
      // Sorteer puur op afstand (dichtst bij eerst)
      eventsWithDistance.sort((a, b) => {
        if (a.distance === undefined && b.distance === undefined) return 0;
        if (a.distance === undefined) return 1;
        if (b.distance === undefined) return -1;
        return a.distance - b.distance;
      });
    }
    
    setVisibleEvents(eventsWithDistance);
  }, [filteredEvents, mapBounds, showExpiredEvents, selectedDays, location, sortOption]);

  // Nieuwe states voor kaart preview mode vs detail mode
  const [isPreviewMode, setIsPreviewMode] = React.useState<boolean>(false);
  const [previewEvent, setPreviewEvent] = React.useState<Event | null>(null);

  const handleMapEventClick = React.useCallback((event: Event) => {
    if (listContainerRef.current) {
      scrollPositionRef.current = listContainerRef.current.scrollTop;
    }
    setActiveEventId(event.id);
    setSelectedEvent(event);
    setIsPreviewMode(false);
    setPreviewEvent(null);
    onEventClick?.(event);
  }, [onEventClick]);

  const handleTileEventClick = React.useCallback((event: Event) => {
    if (listContainerRef.current) {
      scrollPositionRef.current = listContainerRef.current.scrollTop;
    }
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
    const savedPosition = scrollPositionRef.current;
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (listContainerRef.current) {
          listContainerRef.current.scrollTop = savedPosition;
        }
      }, 50);
    });
  }, []);

  const handleNavigateEvent = React.useCallback((direction: 'previous' | 'next') => {
    if (!selectedEvent) return;
    
    // Gebruik visibleEvents (gesorteerd op afstand) voor navigatie
    const currentIndex = visibleEvents.findIndex(e => e.id === selectedEvent.id);
    if (direction === 'previous' && currentIndex > 0) {
      const newEvent = visibleEvents[currentIndex - 1];
      setSelectedEvent(newEvent);
      setActiveEventId(newEvent.id);
    } else if (direction === 'next' && currentIndex < visibleEvents.length - 1) {
      const newEvent = visibleEvents[currentIndex + 1];
      setSelectedEvent(newEvent);
      setActiveEventId(newEvent.id);
    }
  }, [selectedEvent, visibleEvents]);

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
            <div className="h-full overflow-hidden relative">
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
                isWebView={true}
              />
              
              {/* Map action buttons - bottom left */}
              <div className="absolute bottom-4 left-4 z-[100] flex flex-col gap-2">
                <TooltipProvider>
                  {/* Add Event Button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        className="h-12 w-12 rounded-full shadow-lg bg-primary hover:bg-primary/90"
                        onClick={() => setRouterLocation('/create-event')}
                      >
                        <Plus className="h-6 w-6" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Nieuw evenement</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  {/* Filter Button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-12 w-12 rounded-full shadow-lg bg-background"
                        onClick={() => onFilterSidebarOpen?.()}
                      >
                        <SlidersHorizontal className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Filters</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
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
                events={visibleEvents}
                onClose={handleCloseEventDetail}
                onPrevious={() => handleNavigateEvent('previous')}
                onNext={() => handleNavigateEvent('next')}
              />
            ) : (
              /* Event List/Grid View with optional preview */
              <div ref={listContainerRef} className="h-full overflow-y-auto pb-20 px-4 relative">
                {/* Toon het aantal resultaten en sorteeroptie */}
                <div className="sticky top-0 pt-4 pb-3 bg-background z-10 mb-2">
                  <div className="flex justify-between items-center">
                    <div className="text-lg font-medium">
                      {visibleEvents.length} {visibleEvents.length === 1 ? 'evenement' : 'evenementen'}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="flex items-center gap-1 text-sm text-primary font-medium">
                          {sortOption === "time" ? (
                            <>
                              <Clock className="h-4 w-4" />
                              <span>Tijd tot aanvang</span>
                            </>
                          ) : (
                            <>
                              <MapPin className="h-4 w-4" />
                              <span>Afstand</span>
                            </>
                          )}
                          <ChevronDown className="h-3 w-3 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => setSortOption("time")}
                          className={sortOption === "time" ? "bg-accent" : ""}
                        >
                          <Clock className="h-4 w-4 mr-2" />
                          Tijd tot aanvang
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setSortOption("distance")}
                          className={sortOption === "distance" ? "bg-accent" : ""}
                        >
                          <MapPin className="h-4 w-4 mr-2" />
                          Afstand
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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