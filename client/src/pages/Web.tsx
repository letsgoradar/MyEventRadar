import * as React from "react";
import WebLayout from "@/components/Web/WebLayout";
import { useLocation } from "wouter";
import type { EventInterface as Event } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { fetchAllEvents } from "@/lib/api"; 
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { useLocation as useGeoLocation } from "@/hooks/useLocation";
import { LocationSetupScreen } from "@/components/App/LocationSetupScreen";

export default function Web() {
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [radius, setRadius] = React.useState(20);
  const [windowDays, setWindowDays] = React.useState<number | null>(100);
  const { preferences, isAuthenticated: hasPrefs } = useUserPreferences();
  const prefsAppliedRef = React.useRef(false);
  const { location: geoLocation } = useGeoLocation();

  React.useEffect(() => {
    if (hasPrefs && !prefsAppliedRef.current) {
      setRadius(preferences.defaultRadius);
      prefsAppliedRef.current = true;
    }
  }, [hasPrefs, preferences]);

  const [filteredEvents, setFilteredEvents] = React.useState<Event[]>([]);
  
  const debouncedWindowDays = useDebouncedValue(windowDays, 300);

  // Ensure the URL has the web parameter
  React.useEffect(() => {
    if (!location.includes('web=true')) {
      setLocation('/?web=true', { replace: true });
      localStorage.setItem('useWebVersion', 'true');
    }
  }, [location, setLocation]);
  
  const fetchCenter: [number, number] | null = geoLocation
    ? [geoLocation.lat, geoLocation.lng]
    : null;

  // Fetch events based on user location — refetches when location or windowDays changes
  const { data: allEvents, isLoading, isFetching } = useQuery({
    queryKey: ["events-nearby", fetchCenter?.[0]?.toFixed(2), fetchCenter?.[1]?.toFixed(2), debouncedWindowDays],
    queryFn: async () => {
      if (!fetchCenter) return [] as Event[];
      const result = await fetchAllEvents(fetchCenter[0], fetchCenter[1], debouncedWindowDays);
      return result as Event[];
    },
    enabled: !!fetchCenter,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 120,
  });
  
  React.useEffect(() => {
    if (!allEvents || allEvents.length === 0) {
      setFilteredEvents([]);
      return;
    }
    
    let filtered = allEvents;
    
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
    setWindowDays(days);
  }, []);

  if (!geoLocation) {
    return <LocationSetupScreen />;
  }

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
