import * as React from "react";
import AppLayout from "@/components/App/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@/hooks/useLocation";
import { fetchEventsByRadius } from "@/lib/api";
import { EventInterface } from "@shared/schema";
import { EventList } from "@/components/EventList";
import { EventDetailPanel } from "@/components/App/EventDetailPanel";
import { Button } from "@/components/ui/button";
import { LayoutGrid, List } from "lucide-react";
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
    if (user) {
      setShowAuthModal(false);
      if (authTimerRef.current) clearTimeout(authTimerRef.current);
      return;
    }
    authTimerRef.current = setTimeout(() => setShowAuthModal(true), 15000);
    return () => { if (authTimerRef.current) clearTimeout(authTimerRef.current); };
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
  const { data: events = [] } = useQuery({
    queryKey: ["events", location?.lat, location?.lng],
    queryFn: async () => {
      if (!location) return [];
      return fetchEventsByRadius(location.lat, location.lng, 15); // Optimized radius for performance
    },
    enabled: !!location,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
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
        {/* Toon EventList component - altijd in tegelweergave */}
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