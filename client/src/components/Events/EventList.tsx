import React, { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchEventsByRadius } from "@/lib/api";
import { Event } from "@shared/schema";
import EventCard from "./EventCard";
import { Button } from "@/components/ui/button";
import { useLocation } from "@/hooks/useLocation";
import { QuickFilters } from "@/components/QuickFilters";

// Helper function to calculate distance
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c * 10) / 10;
}

export const getCategoryColor = (category: string): string => {
  const colorMap: Record<string, string> = {
    festival: '#FF9800',
    food: '#4CAF50',
    culture: '#9C27B0',
    sports: '#2196F3',
    market: '#FF5722',
    education: '#607D8B',
    music: '#E91E63',
    technology: '#00BCD4',
    gaming: '#8BC34A',
    health: '#FFEB3B',
    nature: '#795548',
  };

  return colorMap[category.toLowerCase()] || '#9E9E9E';
};

function EventList() {
  const { location } = useLocation();
  const [radius, setRadius] = useState(10);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showFreeOnly, setShowFreeOnly] = useState(false);
  const [maxDaysToEvent, setMaxDaysToEvent] = useState(30);
  const [searchQuery, setSearchQuery] = useState('');
  const [eventCounts, setEventCounts] = useState<Record<string, number>>({});
  const [filteredEvents, setFilteredEvents] = useState<Array<Event & { distance: number }>>([]);

  const { data: events = [], isLoading, isError, error } = useQuery({
    queryKey: ["events", location?.lat, location?.lng, radius],
    queryFn: async () => {
      if (!location) return [];
      try {
        return fetchEventsByRadius(location.lat, location.lng, radius);
      } catch (err) {
        console.error("Failed to fetch events:", err);
        return [];
      }
    },
    enabled: !!location,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * (2 ** attemptIndex), 10000),
    placeholderData: [],
  });

  // Process events and calculate distances
  useEffect(() => {
    if (!events || !location) return;

    // Calculate distance for each event and sort by distance
    const eventsWithDistance = events.map((event: Event) => ({
      ...event,
      distance: calculateDistance(
        location.lat,
        location.lng,
        Number(event.latitude),
        Number(event.longitude)
      )
    }));

    // Sort by distance
    eventsWithDistance.sort((a, b) => a.distance - b.distance);

    // Calculate category counts for quick filters
    const counts = { 'all': eventsWithDistance.length };
    eventsWithDistance.forEach((event) => {
      counts[event.category] = (counts[event.category] || 0) + 1;
    });
    setEventCounts(counts);

    // Apply filters
    let filtered = [...eventsWithDistance];

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(event => event.category === selectedCategory);
    }

    if (showFreeOnly) {
      filtered = filtered.filter(event => !event.isPaid);
    }

    // Time filter based on maxDaysToEvent
    const now = new Date();
    filtered = filtered.filter(event => {
      const eventDate = new Date(event.startTime);
      const diffDays = Math.floor((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= maxDaysToEvent;
    });

    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(searchLower) ||
        event.category.toLowerCase().includes(searchLower) ||
        (event.description && event.description.toLowerCase().includes(searchLower))
      );
    }

    setFilteredEvents(filtered);
  }, [events, selectedCategory, showFreeOnly, maxDaysToEvent, searchQuery, location]);

  const handleFilterChange = (updates: any) => {
    if ('category' in updates) setSelectedCategory(updates.category || 'all');
    if ('showFreeOnly' in updates) setShowFreeOnly(updates.showFreeOnly);
    if ('maxDaysToEvent' in updates) setMaxDaysToEvent(updates.maxDaysToEvent);
    if ('searchQuery' in updates) setSearchQuery(updates.searchQuery);
  };

  const incrementRadius = useCallback(() => {
    setRadius(prev => prev + 5);
  }, []);

  if (isLoading) {
    return (
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-200 rounded-lg p-6">
            <div className="flex justify-between mb-4">
              <div className="h-6 w-20 bg-gray-300 rounded"></div>
              <div className="h-6 w-16 bg-gray-300 rounded"></div>
            </div>
            <div className="h-6 bg-gray-300 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-300 rounded w-1/2 mb-4"></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                <div className="h-4 bg-gray-300 rounded w-1/2"></div>
              </div>
              <div className="h-[120px] bg-gray-300 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500 font-medium mb-2">Er is een fout opgetreden bij het ophalen van evenementen.</p>
        <p className="text-sm text-gray-600 mb-4">
          {error instanceof Error ? error.message : "Probeer het later opnieuw."}
        </p>
        <Button onClick={() => window.location.reload()}>
          Vernieuwen
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 overflow-auto max-h-[calc(100vh-10rem)]">
      {/* Quick Filters */}
      <div className="mb-4">
        <QuickFilters
          selectedCategory={selectedCategory}
          showFreeOnly={showFreeOnly}
          maxDaysToEvent={maxDaysToEvent}
          searchQuery={searchQuery}
          onFilterChange={handleFilterChange}
          eventCounts={eventCounts}
          position="left"
        />
      </div>

      {filteredEvents.length === 0 ? (
        <div className="text-center py-8">
          {events.length > 0 ? (
            <div className="p-4 flex flex-col items-center">
              <p className="mb-4 text-center">
                Er zijn evenementen beschikbaar, maar ze voldoen niet aan je huidige filters.
              </p>
              <Button onClick={() => {
                setSelectedCategory('all');
                setShowFreeOnly(false);
                setMaxDaysToEvent(30);
              }}>
                Filters wissen
              </Button>
            </div>
          ) : (
            <div className="p-4 flex flex-col items-center">
              <p className="mb-4 text-center">
                Geen evenementen gevonden in de buurt.
              </p>
              <Button onClick={incrementRadius}>
                Zoekbereik vergroten ({radius} km → {radius + 5} km)
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEvents.map((event) => (
            <EventCard key={event.id} event={event} distance={event.distance} />
          ))}
        </div>
      )}
    </div>
  );
}

export default EventList;