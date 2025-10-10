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

// Uitgebreide Event interface met distance property
interface EventWithDistance extends EventInterface {
  distance?: number;
}

export function AppHomePage() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [radius, setRadius] = React.useState(10);
  const [filteredEvents, setFilteredEvents] = React.useState<EventWithDistance[]>([]);
  const { location } = useLocation();

  // Fetch events based on user location and radius
  const { data: events = [] } = useQuery({
    queryKey: ["events", location?.lat, location?.lng, radius],
    queryFn: async () => {
      if (!location) return [];
      return fetchEventsByRadius(location.lat, location.lng, radius);
    },
    enabled: !!location,
  });

  // Filter events based on search query
  React.useEffect(() => {
    if (!events || !Array.isArray(events)) {
      setFilteredEvents([]);
      return;
    }

    const lowercaseQuery = searchQuery.toLowerCase();
    const filtered = events.filter((event: EventInterface) => {
      return (
        event.title.toLowerCase().includes(lowercaseQuery) ||
        (event.description && event.description.toLowerCase().includes(lowercaseQuery)) ||
        (event.category && event.category.toLowerCase().includes(lowercaseQuery)) ||
        (event.tags && Array.isArray(event.tags) && event.tags.some((tag: string) => tag.toLowerCase().includes(lowercaseQuery)))
      );
    }) as EventWithDistance[];

    setFilteredEvents(prev => {
      // Only update if the filtered results are different
      if (JSON.stringify(prev.map(e => e.id)) === JSON.stringify(filtered.map(e => e.id))) {
        return prev;
      }
      return filtered;
    });
  }, [events, searchQuery]);

  // Gebruik state om bij te houden of de tegelweergave actief is
  const [gridView, setGridView] = React.useState(true);
  
  // State voor event detail overlay
  const [selectedEvent, setSelectedEvent] = React.useState<EventWithDistance | null>(null);

  const handleEventClick = React.useCallback((event: EventWithDistance) => {
    setSelectedEvent(event);
  }, []);

  const handleCloseEventDetail = React.useCallback(() => {
    setSelectedEvent(null);
  }, []);

  const handleNavigateEvent = React.useCallback((direction: 'previous' | 'next') => {
    if (!selectedEvent) return;
    
    const currentIndex = filteredEvents.findIndex(e => e.id === selectedEvent.id);
    if (direction === 'previous' && currentIndex > 0) {
      setSelectedEvent(filteredEvents[currentIndex - 1]);
    } else if (direction === 'next' && currentIndex < filteredEvents.length - 1) {
      setSelectedEvent(filteredEvents[currentIndex + 1]);
    }
  }, [selectedEvent, filteredEvents]);

  return (
    <>
      <AppLayout
        title="Evenementen"
        searchQuery={searchQuery}
        radius={radius}
        filteredEvents={filteredEvents}
        onSearch={setSearchQuery}
        onRadiusChange={setRadius}
        showMap={true}
        hideViewToggle={true}
        defaultView="map"
        onEventClick={handleEventClick}
      >
        {/* Toon EventList component - altijd in tegelweergave */}
        <EventList 
          searchQuery={searchQuery}
          radius={radius}
          filteredEvents={filteredEvents}
          gridView={true}
          onEventClick={handleEventClick}
        />
      </AppLayout>
      
      {/* Event Detail Overlay - BUITEN AppLayout zodat het altijd wordt gerenderd */}
      {selectedEvent && (
        <EventDetailPanel
          event={selectedEvent}
          events={filteredEvents}
          onClose={handleCloseEventDetail}
          onPrevious={() => handleNavigateEvent('previous')}
          onNext={() => handleNavigateEvent('next')}
        />
      )}
    </>
  );
}

export default AppHomePage;