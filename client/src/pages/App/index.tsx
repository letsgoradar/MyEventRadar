import * as React from "react";
import AppLayout from "@/components/App/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@/hooks/useLocation";
import { fetchEventsByRadius } from "@/lib/api";
import { EventInterface } from "@shared/schema";
import { EventList } from "@/components/EventList";
import { EventDetailPanel } from "@/components/App/EventDetailPanel";
import { Button } from "@/components/ui/button";
import { LayoutGrid, List, Loader2, MapPin } from "lucide-react";
import { addDays, startOfDay } from "date-fns";
import { AssistantButton } from "@/components/Assistant/AssistantButton";
import { AuthModal } from "@/components/Auth/AuthModal";
import { useAuth } from "@/hooks/use-auth";

// Uitgebreide Event interface met distance property
interface EventWithDistance extends EventInterface {
  distance?: number;
}

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

export function AppHomePage() {
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  const authTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (user && user.emailVerified !== false) {
      setShowAuthModal(false);
      if (authTimerRef.current) clearTimeout(authTimerRef.current);
      return;
    }
    if (!user) {
      authTimerRef.current = setTimeout(() => setShowAuthModal(true), 15000);
      return () => { if (authTimerRef.current) clearTimeout(authTimerRef.current); };
    }
  }, [user]);

  const handleAuthClose = React.useCallback(() => {
    setShowAuthModal(false);
    if (!user) {
      authTimerRef.current = setTimeout(() => setShowAuthModal(true), 60000);
    }
  }, [user]);

  const handleAuthSuccess = React.useCallback(() => {
    setShowAuthModal(false);
    if (authTimerRef.current) clearTimeout(authTimerRef.current);
  }, []);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [filteredEvents, setFilteredEvents] = React.useState<EventWithDistance[]>([]);
  const { location } = useLocation();
  
  // Standaard: geen datumfilter actief (lege array = alle toekomstige evenementen)
  const [selectedDays, setSelectedDays] = React.useState<Date[]>([]);

  // Fetch events based on user location (optimized radius for faster loading)
  const { data: events = [], isLoading: eventsLoading, isFetching: eventsRefetching } = useQuery({
    queryKey: ["events", location?.lat, location?.lng],
    queryFn: async () => {
      if (!location) return [];
      return fetchEventsByRadius(location.lat, location.lng, 15);
    },
    enabled: !!location,
    staleTime: 5 * 60 * 1000,
  });

  // Filter events based on search query and selected days, then sort by distance
  React.useEffect(() => {
    if (!events || !Array.isArray(events)) {
      setFilteredEvents([]);
      return;
    }

    const lowercaseQuery = searchQuery.toLowerCase();
    let filtered = events.filter((event: EventInterface) => {
      return (
        event.title.toLowerCase().includes(lowercaseQuery) ||
        (event.description && event.description.toLowerCase().includes(lowercaseQuery)) ||
        (event.category && event.category.toLowerCase().includes(lowercaseQuery)) ||
        (event.tags && Array.isArray(event.tags) && event.tags.some((tag: string) => tag.toLowerCase().includes(lowercaseQuery)))
      );
    }) as EventWithDistance[];
    
    // Filter op geselecteerde dagen (als er dagen zijn geselecteerd)
    if (selectedDays.length > 0) {
      filtered = filtered.filter(event => {
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
    
    // Bereken afstand en sorteer op afstand (dichtst bij eerst)
    const eventsWithDistance: EventWithDistance[] = filtered.map(event => {
      const distance = location 
        ? calculateDistance(location.lat, location.lng, Number(event.latitude), Number(event.longitude))
        : undefined;
      return { ...event, distance };
    });
    
    // Sorteer op afstand (dichtst bij eerst)
    eventsWithDistance.sort((a, b) => {
      if (a.distance === undefined && b.distance === undefined) return 0;
      if (a.distance === undefined) return 1;
      if (b.distance === undefined) return -1;
      return a.distance - b.distance;
    });

    setFilteredEvents(prev => {
      // Only update if the filtered results are different
      if (JSON.stringify(prev.map(e => e.id)) === JSON.stringify(eventsWithDistance.map(e => e.id))) {
        return prev;
      }
      return eventsWithDistance;
    });
  }, [events, searchQuery, selectedDays, location]);

  // Gebruik state om bij te houden of de tegelweergave actief is
  const [gridView, setGridView] = React.useState(true);
  
  // State voor event detail overlay
  const [selectedEvent, setSelectedEvent] = React.useState<EventWithDistance | null>(null);
  
  // State voor bounds-filtered events (voor navigatie)
  const [visibleEvents, setVisibleEvents] = React.useState<EventWithDistance[]>([]);

  const handleEventClick = React.useCallback((event: EventWithDistance) => {
    setSelectedEvent(event);
  }, []);

  const handleCloseEventDetail = React.useCallback(() => {
    setSelectedEvent(null);
  }, []);

  const handleNavigateEvent = React.useCallback((direction: 'previous' | 'next') => {
    if (!selectedEvent) return;
    
    // Gebruik visibleEvents (bounds-filtered) voor navigatie
    const eventsToNavigate = visibleEvents.length > 0 ? visibleEvents : filteredEvents;
    const currentIndex = eventsToNavigate.findIndex(e => e.id === selectedEvent.id);
    if (direction === 'previous' && currentIndex > 0) {
      setSelectedEvent(eventsToNavigate[currentIndex - 1]);
    } else if (direction === 'next' && currentIndex < eventsToNavigate.length - 1) {
      setSelectedEvent(eventsToNavigate[currentIndex + 1]);
    }
  }, [selectedEvent, visibleEvents, filteredEvents]);

  const isFirstLoad = eventsLoading && events.length === 0;

  return (
    <>
      <AppLayout
        title="Evenementen"
        searchQuery={searchQuery}
        filteredEvents={filteredEvents}
        onSearch={setSearchQuery}
        showMap={true}
        hideViewToggle={true}
        defaultView="map"
        onEventClick={handleEventClick}
        onBoundsFilteredEventsChange={setVisibleEvents}
        selectedEventId={selectedEvent?.id ?? null}
      >
        {isFirstLoad && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-[200]">
            <div className="flex flex-col items-center gap-4 p-8 bg-card rounded-xl shadow-lg border">
              <div className="relative flex items-center justify-center w-16 h-16">
                <MapPin className="h-12 w-12 text-primary animate-bounce" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-lg">Events laden...</h3>
                <p className="text-sm text-muted-foreground">We zoeken naar activiteiten in jouw buurt</p>
              </div>
            </div>
          </div>
        )}

        {eventsRefetching && !eventsLoading && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[200] bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-full text-sm flex items-center gap-2 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Bijwerken...</span>
          </div>
        )}

        <EventList 
          searchQuery={searchQuery}
          radius={10}
          filteredEvents={filteredEvents}
          gridView={true}
          onEventClick={handleEventClick}
        />
      </AppLayout>
      
      {/* Event Detail Overlay - BUITEN AppLayout zodat het altijd wordt gerenderd */}
      {selectedEvent && (
        <EventDetailPanel
          event={selectedEvent}
          events={visibleEvents.length > 0 ? visibleEvents : filteredEvents}
          onClose={handleCloseEventDetail}
          onPrevious={() => handleNavigateEvent('previous')}
          onNext={() => handleNavigateEvent('next')}
          userLocation={location || undefined}
        />
      )}
      
      {/* AI Assistant temporarily hidden */}
      {/* <AssistantButton /> */}
      
      <AuthModal
        isOpen={showAuthModal}
        onClose={handleAuthClose}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}

export default AppHomePage;