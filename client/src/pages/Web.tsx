import * as React from "react";
import WebLayout from "@/components/Web/WebLayout";
import { useLocation } from "wouter";
import type { EventInterface as Event } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { fetchAllEvents } from "@/lib/api"; 
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useUserPreferences } from "@/hooks/use-user-preferences";

const NL_CENTER: [number, number] = [52.1326, 5.2913];

export default function Web() {
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [radius, setRadius] = React.useState(20);
  const [windowDays, setWindowDays] = React.useState<number | null>(100);
  const [fetchCenter, setFetchCenter] = React.useState<[number, number]>(NL_CENTER);
  const { preferences, isAuthenticated: hasPrefs } = useUserPreferences();
  const prefsAppliedRef = React.useRef(false);

  React.useEffect(() => {
    if (hasPrefs && !prefsAppliedRef.current) {
      setRadius(preferences.defaultRadius);
      prefsAppliedRef.current = true;
    }
  }, [hasPrefs, preferences]);

  React.useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setFetchCenter([pos.coords.latitude, pos.coords.longitude]),
      () => {} // fallback to NL center on denial
    );
  }, []);

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
  
  // Fetch events based on user location — refetches when location or windowDays changes
  const { data: allEvents, isLoading, isFetching } = useQuery({
    queryKey: ["events-nearby", fetchCenter[0].toFixed(2), fetchCenter[1].toFixed(2), debouncedWindowDays],
    queryFn: async () => {
      const result = await fetchAllEvents(fetchCenter[0], fetchCenter[1], debouncedWindowDays);
      return result as Event[];
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 120, // 2 hours
  });
  
  // Client-side filtering based on search query only
  // Radius filtering is now handled in SplitView based on map viewport
  // This allows the map to show ALL events as clusters while the list shows nearby events
  React.useEffect(() => {
    if (!allEvents || allEvents.length === 0) {
      setFilteredEvents([]);
      return;
    }
    
    let filtered = allEvents;
    
    // Filter by search query only - radius filtering moved to SplitView
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((event) => 
        event.title.toLowerCase().includes(query) ||
        (event.description && event.description.toLowerCase().includes(query)) ||
        (event.category && event.category.toLowerCase().includes(query))
      );
    }
    
    setFilteredEvents(filtered);
  }, [allEvents, searchQuery]);
  
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