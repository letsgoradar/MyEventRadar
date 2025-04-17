import * as React from "react";
import { App2Layout } from "@/components/App2/App2Layout";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@/hooks/useLocation";
import { fetchEventsByRadius } from "@/lib/api";
import { Event } from "@shared/schema";
import { EventList } from "@/components/EventList";
import { Button } from "@/components/ui/button";
import { LayoutGrid, List } from "lucide-react";

export function App2HomePage() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [radius, setRadius] = React.useState(10);
  const [filteredEvents, setFilteredEvents] = React.useState<Event[]>([]);
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
    const filtered = events.filter((event: Event) => {
      return (
        event.title.toLowerCase().includes(lowercaseQuery) ||
        (event.description && event.description.toLowerCase().includes(lowercaseQuery)) ||
        (event.category && event.category.toLowerCase().includes(lowercaseQuery)) ||
        (event.tags && Array.isArray(event.tags) && event.tags.some((tag: string) => tag.toLowerCase().includes(lowercaseQuery)))
      );
    });

    setFilteredEvents(filtered);
  }, [events, searchQuery]);

  // Gebruik state om bij te houden of de tegelweergave actief is
  const [gridView, setGridView] = React.useState(true);

  return (
    <App2Layout
      title="Evenementen"
      searchQuery={searchQuery}
      radius={radius}
      filteredEvents={filteredEvents}
      onSearch={setSearchQuery}
      onRadiusChange={setRadius}
      onFilteredEventsChange={setFilteredEvents}
      showMap={true}
    >
      {/* Toon knoppen om tussen lijst- en tegelweergave te schakelen */}
      <div className="flex justify-end mb-4">
        <div className="border rounded-md flex">
          <Button
            variant={!gridView ? "secondary" : "ghost"}
            size="sm"
            className="h-9 w-9 p-0 rounded-r-none"
            onClick={() => setGridView(false)}
            title="Lijstweergave"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={gridView ? "secondary" : "ghost"}
            size="sm"
            className="h-9 w-9 p-0 rounded-l-none"
            onClick={() => setGridView(true)}
            title="Tegelweergave"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Toon EventList component met gekozen weergave */}
      <EventList 
        searchQuery={searchQuery}
        radius={radius}
        filteredEvents={filteredEvents}
        gridView={gridView}
      />
    </App2Layout>
  );
}

export default App2HomePage;