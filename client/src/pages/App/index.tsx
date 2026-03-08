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
import { useSearch } from "wouter";
import type L from "leaflet";

interface EventWithDistance extends EventInterface {
  distance?: number;
}

function boundsToRadius(bounds: L.LatLngBounds): number {
  const center = bounds.getCenter();
  const ne = bounds.getNorthEast();
  const R = 6371;
  const dLat = (ne.lat - center.lat) * Math.PI / 180;
  const dLng = (ne.lng - center.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(center.lat * Math.PI / 180) * Math.cos(ne.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return dist;
}

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
  const searchString = useSearch();
  const authFromQuery = new URLSearchParams(searchString).get("auth");
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  const authTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (authFromQuery === "create" && !user) {
      setShowAuthModal(true);
    }
  }, [authFromQuery, user]);

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
    if (authFromQuery === "create") {
      window.history.replaceState({}, "", "/app/create");
      window.location.href = "/app/create";
    }
  }, [authFromQuery]);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [filteredEvents, setFilteredEvents] = React.useState<EventWithDistance[]>([]);
  const { location } = useLocation();
  
  const [selectedDays, setSelectedDays] = React.useState<Date[]>([]);

  const [mapRadius, setMapRadius] = React.useState<number | null>(null);

  const handleMapBoundsChange = React.useCallback((bounds: L.LatLngBounds) => {
    const needed = Math.ceil(boundsToRadius(bounds));
    const clamped = Math.max(10, Math.min(needed, 500));
    if (mapRadius === null) {
      setMapRadius(clamped);
    }
  }, [mapRadius]);

  const {
    data: mapEvents = [],
    isLoading: mapLoading,
  } = useQuery({
    queryKey: ["events-map", location?.lat, location?.lng, mapRadius],
    queryFn: async () => {
      if (!location || !mapRadius) return [];
      return fetchEventsByRadius(location.lat, location.lng, mapRadius, 100);
    },
    enabled: !!location && mapRadius !== null,
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: bgEvents = [],
    isLoading: bgLoading,
  } = useQuery({
    queryKey: ["events-bg", location?.lat, location?.lng],
    queryFn: async () => {
      if (!location) return [];
      return fetchEventsByRadius(location.lat, location.lng, 200, 100);
    },
    enabled: !!location && mapEvents.length > 0,
    staleTime: 10 * 60 * 1000,
  });

  const allEvents = React.useMemo(() => {
    if (bgEvents.length > 0) {
      const seen = new Set<number>();
      const merged: EventInterface[] = [];
      for (const e of mapEvents) {
        if (!seen.has(e.id)) { seen.add(e.id); merged.push(e); }
      }
      for (const e of bgEvents) {
        if (!seen.has(e.id)) { seen.add(e.id); merged.push(e); }
      }
      return merged;
    }
    return mapEvents;
  }, [mapEvents, bgEvents]);

  React.useEffect(() => {
    if (!allEvents || !Array.isArray(allEvents)) {
      setFilteredEvents([]);
      return;
    }

    const lowercaseQuery = searchQuery.toLowerCase();
    let filtered = allEvents.filter((event: EventInterface) => {
      if (!lowercaseQuery) return true;
      return (
        event.title.toLowerCase().includes(lowercaseQuery) ||
        (event.description && event.description.toLowerCase().includes(lowercaseQuery)) ||
        (event.category && event.category.toLowerCase().includes(lowercaseQuery)) ||
        (event.tags && Array.isArray(event.tags) && event.tags.some((tag: string) => tag.toLowerCase().includes(lowercaseQuery)))
      );
    }) as EventWithDistance[];
    
    if (selectedDays.length > 0) {
      filtered = filtered.filter(event => {
        const eventStart = startOfDay(new Date(event.startTime));
        const eventEnd = startOfDay(new Date(event.endTime || event.startTime));
        
        return selectedDays.some(selectedDay => {
          const selected = startOfDay(selectedDay);
          return (eventStart <= selected && eventEnd >= selected) || 
                 (eventStart.getTime() === selected.getTime());
        });
      });
    }
    
    const eventsWithDistance: EventWithDistance[] = filtered.map(event => {
      const distance = location 
        ? calculateDistance(location.lat, location.lng, Number(event.latitude), Number(event.longitude))
        : undefined;
      return { ...event, distance };
    });
    
    eventsWithDistance.sort((a, b) => {
      if (a.distance === undefined && b.distance === undefined) return 0;
      if (a.distance === undefined) return 1;
      if (b.distance === undefined) return -1;
      return a.distance - b.distance;
    });

    setFilteredEvents(prev => {
      if (JSON.stringify(prev.map(e => e.id)) === JSON.stringify(eventsWithDistance.map(e => e.id))) {
        return prev;
      }
      return eventsWithDistance;
    });
  }, [allEvents, searchQuery, selectedDays, location]);

  const [gridView, setGridView] = React.useState(true);
  const [selectedEvent, setSelectedEvent] = React.useState<EventWithDistance | null>(null);
  const [visibleEvents, setVisibleEvents] = React.useState<EventWithDistance[]>([]);

  const handleEventClick = React.useCallback((event: EventWithDistance) => {
    setSelectedEvent(event);
  }, []);

  const handleCloseEventDetail = React.useCallback(() => {
    setSelectedEvent(null);
  }, []);

  const handleNavigateEvent = React.useCallback((direction: 'previous' | 'next') => {
    if (!selectedEvent) return;
    
    const eventsToNavigate = visibleEvents.length > 0 ? visibleEvents : filteredEvents;
    const currentIndex = eventsToNavigate.findIndex(e => e.id === selectedEvent.id);
    if (direction === 'previous' && currentIndex > 0) {
      setSelectedEvent(eventsToNavigate[currentIndex - 1]);
    } else if (direction === 'next' && currentIndex < eventsToNavigate.length - 1) {
      setSelectedEvent(eventsToNavigate[currentIndex + 1]);
    }
  }, [selectedEvent, visibleEvents, filteredEvents]);

  const isFirstLoad = mapLoading || (!!location && mapRadius === null);

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
        onMapBoundsChange={handleMapBoundsChange}
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
                <p className="text-sm text-muted-foreground">
                  We zoeken naar activiteiten in jouw buurt
                </p>
              </div>
            </div>
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
      
      {selectedEvent && (
        <EventDetailPanel
          event={selectedEvent}
          events={visibleEvents.length > 0 ? visibleEvents : filteredEvents}
          onClose={handleCloseEventDetail}
          onPrevious={() => handleNavigateEvent('previous')}
          onNext={() => handleNavigateEvent('next')}
          userLocation={location || undefined}
          onAuthRequired={() => setShowAuthModal(true)}
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
