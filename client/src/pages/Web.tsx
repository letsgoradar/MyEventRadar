import * as React from "react";
import WebLayout from "@/components/Web/WebLayout";
import { useLocation } from "wouter";
import { Event } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { fetchEventsByRadius } from "@/lib/api"; 
import { useLocation as useGeoLocation } from "@/hooks/useLocation";
import L from "leaflet";

export default function Web() {
  const [location, setLocation] = useLocation();
  const { location: geoLocation } = useGeoLocation();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [radius, setRadius] = React.useState(10); // Nog steeds nodig voor API calls, maar niet getoond in UI
  const [filteredEvents, setFilteredEvents] = React.useState<Event[]>([]);
  const [visibleMapArea, setVisibleMapArea] = React.useState<L.LatLngBounds | null>(null);
  const [dateFilter, setDateFilter] = React.useState<{ start: Date; end?: Date } | null>(null);

  // Ensure the URL has the web parameter
  React.useEffect(() => {
    if (!location.includes('web=true')) {
      setLocation('/?web=true', { replace: true });
      
      // Also store preference
      localStorage.setItem('useWebVersion', 'true');
    }
  }, [location, setLocation]);
  
  // Fetch events based on location - radius wordt nu bepaald door kaartweergave
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
  
  // Filter events based on search query and date filter
  React.useEffect(() => {
    if (!events || events.length === 0) return;
    
    let filtered = events.filter((event) => {
      // Filter op basis van zoekopdracht
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesQuery = (
          event.title.toLowerCase().includes(query) ||
          (event.description && event.description.toLowerCase().includes(query)) ||
          (event.category && event.category.toLowerCase().includes(query))
        );
        if (!matchesQuery) return false;
      }
      
      // Filter op basis van datum
      if (dateFilter) {
        const eventStartTime = new Date(event.startTime);
        const eventEndTime = event.endTime ? new Date(event.endTime) : 
          new Date(eventStartTime.getTime() + 2 * 60 * 60 * 1000); // 2 uur default
        
        // Check of het event binnen de datumfilter valt
        if (dateFilter.start && dateFilter.end) {
          // Event moet overlappen met de datumrange
          return (
            (eventStartTime <= dateFilter.end && eventEndTime >= dateFilter.start) ||
            (eventStartTime >= dateFilter.start && eventStartTime <= dateFilter.end)
          );
        } else if (dateFilter.start) {
          // Alleen startdatum - event moet op of na deze datum beginnen
          return eventStartTime >= dateFilter.start;
        }
        
        return false;
      }
      
      return true;
    });
    
    setFilteredEvents(filtered);
  }, [events, searchQuery, dateFilter]);
  
  const handleSearch = React.useCallback((query: string) => {
    setSearchQuery(query);
  }, []);
  
  const handleRadiusChange = React.useCallback((value: number) => {
    // We gebruiken nog steeds radius voor API calls op de achtergrond
    setRadius(value);
  }, []);
  
  const handleDateRangeChange = React.useCallback((range: { start: Date; end?: Date }) => {
    setDateFilter(range);
  }, []);

  return (
    <WebLayout 
      searchQuery={searchQuery}
      radius={radius}
      filteredEvents={filteredEvents}
      onSearch={handleSearch}
      onRadiusChange={handleRadiusChange}
      onDateRangeChange={handleDateRangeChange}
    />
  );
}