import * as React from "react";
import { App2Layout } from "@/components/App2/App2Layout";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@/hooks/useLocation";
import { fetchEventsByRadius } from "@/lib/api";
import { Event } from "@shared/schema";
import { EventList } from "@/components/EventList";

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
    if (!events) return;

    const lowercaseQuery = searchQuery.toLowerCase();
    const filtered = events.filter((event) => {
      return (
        event.title.toLowerCase().includes(lowercaseQuery) ||
        (event.description && event.description.toLowerCase().includes(lowercaseQuery)) ||
        (event.category && event.category.toLowerCase().includes(lowercaseQuery)) ||
        (event.tags && event.tags.some((tag) => tag.toLowerCase().includes(lowercaseQuery)))
      );
    });

    setFilteredEvents(filtered);
  }, [events, searchQuery]);

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
      <div>
        {/* Hier kunnen we eventueel andere elementen toevoegen naast de kaart */}
      </div>
    </App2Layout>
  );
}

export default App2HomePage;