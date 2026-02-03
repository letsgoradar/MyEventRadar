import * as React from "react";
import WebLayout from "@/components/Web/WebLayout";
import { useLocation } from "wouter";
import type { EventInterface as Event } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { fetchEventsByRadius } from "@/lib/api"; 
import { useLocation as useGeoLocation } from "@/hooks/useLocation";
import { useDebouncedValue } from "@/hooks/use-debounce";
import L from "leaflet";

export default function Web() {
  const [location, setLocation] = useLocation();
  const { location: geoLocation } = useGeoLocation();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [radius, setRadius] = React.useState(10);
  const [windowDays, setWindowDays] = React.useState<number | null>(null); // null = alle events
  const [filteredEvents, setFilteredEvents] = React.useState<Event[]>([]);
  const [visibleMapArea, setVisibleMapArea] = React.useState<L.LatLngBounds | null>(null);
  
  // Debounce location and radius changes to prevent excessive API calls
  // Wait 400ms after last change before fetching
  const debouncedLat = useDebouncedValue(geoLocation?.lat, 400);
  const debouncedLng = useDebouncedValue(geoLocation?.lng, 400);
  const debouncedRadius = useDebouncedValue(radius, 400);
  const debouncedWindowDays = useDebouncedValue(windowDays, 300);

  // Ensure the URL has the web parameter
  React.useEffect(() => {
    if (!location.includes('web=true')) {
      setLocation('/?web=true', { replace: true });
      
      // Also store preference
      localStorage.setItem('useWebVersion', 'true');
    }
  }, [location, setLocation]);
  
  // Fetch events based on DEBOUNCED location - prevents API spam during map movement
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["events", debouncedLat, debouncedLng, debouncedRadius, debouncedWindowDays],
    queryFn: async () => {
      if (debouncedLat && debouncedLng) {
        const result = await fetchEventsByRadius(debouncedLat, debouncedLng, debouncedRadius, debouncedWindowDays);
        return result as Event[];
      }
      return [] as Event[];
    },
    enabled: !!(debouncedLat && debouncedLng),
    staleTime: 1000 * 60 * 10, // 10 minutes - events don't change often
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
  });
  
  const events = data || [];
  
  // Filter events based on search query
  React.useEffect(() => {
    if (!events || events.length === 0) return;
    
    const filtered = events.filter((event) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        event.title.toLowerCase().includes(query) ||
        (event.description && event.description.toLowerCase().includes(query)) ||
        (event.category && event.category.toLowerCase().includes(query))
      );
    });
    
    setFilteredEvents(filtered);
  }, [events, searchQuery]);
  
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
  const isInitialLoading = isLoading && !data; // First load ever
  const isRefetching = isFetching && !!data; // Background refetch

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