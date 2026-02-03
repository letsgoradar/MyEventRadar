import * as React from "react";
import WebLayout from "@/components/Web/WebLayout";
import { useLocation } from "wouter";
import type { EventInterface as Event } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { fetchAllEvents, calculateDistance } from "@/lib/api"; 
import { useLocation as useGeoLocation } from "@/hooks/useLocation";
import { useDebouncedValue } from "@/hooks/use-debounce";

export default function Web() {
  const [location, setLocation] = useLocation();
  const { location: geoLocation } = useGeoLocation();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [radius, setRadius] = React.useState(10);
  const [windowDays, setWindowDays] = React.useState<number | null>(null); // null = alle events
  const [filteredEvents, setFilteredEvents] = React.useState<Event[]>([]);
  
  // Debounce only windowDays for API calls (radius is now client-side)
  const debouncedWindowDays = useDebouncedValue(windowDays, 300);

  // Ensure the URL has the web parameter
  React.useEffect(() => {
    if (!location.includes('web=true')) {
      setLocation('/?web=true', { replace: true });
      localStorage.setItem('useWebVersion', 'true');
    }
  }, [location, setLocation]);
  
  // Fetch ALL events once at startup - enables instant zoom/pan
  // Only refetches when windowDays changes
  const { data: allEvents, isLoading, isFetching } = useQuery({
    queryKey: ["all-events", debouncedWindowDays],
    queryFn: async () => {
      const result = await fetchAllEvents(52.1326, 5.2913, debouncedWindowDays);
      return result as Event[];
    },
    staleTime: 1000 * 60 * 15, // 15 minutes - events don't change often
    gcTime: 1000 * 60 * 60, // Keep in cache for 1 hour
  });
  
  // Client-side filtering based on radius, search query, and user location
  // This runs instantly when radius/location changes - no API calls needed!
  React.useEffect(() => {
    if (!allEvents || allEvents.length === 0) {
      setFilteredEvents([]);
      return;
    }
    
    let filtered = allEvents;
    
    // Filter by radius from user's location
    if (geoLocation?.lat && geoLocation?.lng) {
      filtered = filtered.filter((event) => {
        const eventLat = typeof event.latitude === 'string' ? parseFloat(event.latitude) : event.latitude;
        const eventLng = typeof event.longitude === 'string' ? parseFloat(event.longitude) : event.longitude;
        if (!eventLat || !eventLng) return false;
        
        const distance = calculateDistance(geoLocation.lat, geoLocation.lng, eventLat, eventLng);
        return distance <= radius;
      });
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((event) => 
        event.title.toLowerCase().includes(query) ||
        (event.description && event.description.toLowerCase().includes(query)) ||
        (event.category && event.category.toLowerCase().includes(query))
      );
    }
    
    setFilteredEvents(filtered);
  }, [allEvents, geoLocation, radius, searchQuery]);
  
  const handleSearch = React.useCallback((query: string) => {
    setSearchQuery(query);
  }, []);
  
  const handleRadiusChange = React.useCallback((value: number) => {
    setRadius(value);
  }, []);
  
  const handleWindowDaysChange = React.useCallback((days: number | null) => {
    console.log('Window days changed to:', days);
    setWindowDays(days);
  }, []);

  // Determine loading states
  const isInitialLoading = isLoading && !allEvents;
  const isRefetching = isFetching && !!allEvents;

  return (
    <WebLayout 
      searchQuery={searchQuery}
      radius={radius}
      filteredEvents={filteredEvents}
      onSearch={handleSearch}
      onRadiusChange={handleRadiusChange}
      onWindowDaysChange={handleWindowDaysChange}
      isLoading={isInitialLoading}
      isRefetching={isRefetching}
    />
  );
}