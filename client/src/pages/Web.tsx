import * as React from "react";
import WebLayout from "@/components/Web/WebLayout";
import { useLocation } from "wouter";
import { Event } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { fetchEventsByRadius } from "@/lib/api"; 
import { useLocation as useGeoLocation } from "@/hooks/useLocation";

export default function Web() {
  const [location, setLocation] = useLocation();
  const { location: geoLocation } = useGeoLocation();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [radius, setRadius] = React.useState(10);
  const [filteredEvents, setFilteredEvents] = React.useState<Event[]>([]);

  // Ensure the URL has the web parameter
  React.useEffect(() => {
    if (!location.includes('web=true')) {
      setLocation('/?web=true', { replace: true });
      
      // Also store preference
      localStorage.setItem('useWebVersion', 'true');
    }
  }, [location, setLocation]);
  
  // Fetch events based on location
  const { data } = useQuery({
    queryKey: ["events", geoLocation?.lat, geoLocation?.lng, radius],
    queryFn: async () => {
      if (geoLocation) {
        const result = await fetchEventsByRadius(geoLocation.lat, geoLocation.lng, radius);
        return result as Event[];
      }
      return [] as Event[];
    },
    enabled: !!geoLocation,
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

  return (
    <WebLayout 
      searchQuery={searchQuery}
      radius={radius}
      filteredEvents={filteredEvents}
      onSearch={handleSearch}
      onRadiusChange={handleRadiusChange}
    />
  );
}