import * as React from "react";
import AppLayout from "@/components/App/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@/hooks/useLocation";
import { fetchEventsByRadius } from "@/lib/api";
import { EventInterface } from "@shared/schema";
import { EventList } from "@/components/EventList";
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
    if (!events || !Array.isArray(events)) return;

    const lowercaseQuery = searchQuery.toLowerCase();
    const filtered = events.filter((event: EventInterface) => {
      return (
        event.title.toLowerCase().includes(lowercaseQuery) ||
        (event.description && event.description.toLowerCase().includes(lowercaseQuery)) ||
        (event.category && event.category.toLowerCase().includes(lowercaseQuery)) ||
        (event.tags && Array.isArray(event.tags) && event.tags.some((tag: string) => tag.toLowerCase().includes(lowercaseQuery)))
      );
    }) as EventWithDistance[];

    setFilteredEvents(filtered);
  }, [events, searchQuery]);

  // Gebruik state om bij te houden of de tegelweergave actief is
  const [gridView, setGridView] = React.useState(true);

  return (
    <AppLayout
      title="Evenementen"
      searchQuery={searchQuery}
      radius={radius}
      filteredEvents={filteredEvents}
      onSearch={setSearchQuery}
      onRadiusChange={setRadius}
      onFilteredEventsChange={setFilteredEvents}
      showMap={true}
    >
      {/* Toon EventList component - altijd in tegelweergave */}
      <EventList 
        searchQuery={searchQuery}
        radius={radius}
        filteredEvents={filteredEvents}
        gridView={true}
      />
    </AppLayout>
  );
}

export default AppHomePage;