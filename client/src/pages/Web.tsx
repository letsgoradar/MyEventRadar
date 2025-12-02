import * as React from "react";
import WebLayout from "@/components/Web/WebLayout";
import { useLocation } from "wouter";
import { EventInterface } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { fetchEventsByRadius } from "@/lib/api"; 
import { useLocation as useGeoLocation } from "@/hooks/useLocation";
import L from "leaflet";

export default function Web() {
  const [location, setLocation] = useLocation();
  const { location: geoLocation } = useGeoLocation();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [radius, setRadius] = React.useState(10); // Nog steeds nodig voor API calls, maar niet getoond in UI
  const [filteredEvents, setFilteredEvents] = React.useState<EventInterface[]>([]);
  const [visibleMapArea, setVisibleMapArea] = React.useState<L.LatLngBounds | null>(null);

  // Ensure the URL has the web parameter
  React.useEffect(() => {
    if (!location.includes('web=true')) {
      setLocation('/?web=true', { replace: true });
      
      // Also store preference
      localStorage.setItem('useWebVersion', 'true');
    }
  }, [location, setLocation]);
  
  // Fetch events based on location - gebruik vaste grote radius zodat events blijven staan bij zoom
  const { data } = useQuery({
    queryKey: ["events", geoLocation?.lat, geoLocation?.lng],
    queryFn: async () => {
      if (geoLocation) {
        // Gebruik vaste grote radius (50km) om alle events in de regio te fetchen
        // Dit voorkomt dat events herladen bij zoom in/uit
        const result = await fetchEventsByRadius(geoLocation.lat, geoLocation.lng, 50);
        return result as EventInterface[];
      }
      return [] as EventInterface[];
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
    // We gebruiken nog steeds radius voor API calls op de achtergrond
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