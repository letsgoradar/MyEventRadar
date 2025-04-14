import * as React from "react";
import { Event } from "@shared/schema";
import { App2BottomNav } from "./App2BottomNav";
import { App2Header } from "./App2Header";
import { MapView } from "@/components/Map/MapView";
import { EventList } from "@/components/EventList";
import { useIsMobile } from "@/hooks/use-mobile";

interface App2LayoutProps {
  children?: React.ReactNode;
  searchQuery?: string;
  radius?: number;
  filteredEvents?: Event[];
  onSearch?: (query: string) => void;
  onRadiusChange?: (radius: number) => void;
  onFilteredEventsChange?: (events: Event[]) => void;
}

export function App2Layout({ 
  children,
  searchQuery: propSearchQuery,
  radius: propRadius,
  filteredEvents: propFilteredEvents,
  onSearch: propOnSearch,
  onRadiusChange: propOnRadiusChange,
  onFilteredEventsChange: propOnFilteredEventsChange
}: App2LayoutProps) {
  const [searchQuery, setSearchQuery] = React.useState(propSearchQuery || "");
  const [radius, setRadius] = React.useState(propRadius || 10);
  const [filteredEvents, setFilteredEvents] = React.useState<Event[]>(propFilteredEvents || []);
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
  const [isMapView, setIsMapView] = React.useState(true);

  // Update state when props change
  React.useEffect(() => {
    if (propSearchQuery !== undefined) setSearchQuery(propSearchQuery);
  }, [propSearchQuery]);

  React.useEffect(() => {
    if (propRadius !== undefined) setRadius(propRadius);
  }, [propRadius]);

  React.useEffect(() => {
    if (propFilteredEvents !== undefined) setFilteredEvents(propFilteredEvents);
  }, [propFilteredEvents]);

  // Handlers
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    propOnSearch?.(query);
  };

  const handleRadiusChange = (newRadius: number) => {
    setRadius(newRadius);
    propOnRadiusChange?.(newRadius);
  };

  const handleFilteredEventsChange = (events: Event[]) => {
    setFilteredEvents(events);
    propOnFilteredEventsChange?.(events);
  };

  const handleCategoriesChange = (categories: string[]) => {
    setSelectedCategories(categories);
  };

  const toggleView = () => {
    setIsMapView(!isMapView);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <App2Header 
        isMapView={isMapView}
        toggleView={toggleView}
        onSearch={handleSearch}
        radius={radius}
        onRadiusChange={handleRadiusChange}
        onCategoriesChange={handleCategoriesChange}
      />
      
      {children ? (
        <div className="flex-1 overflow-auto pb-20">{children}</div>
      ) : (
        <div className="flex-1 relative overflow-hidden">
          {isMapView ? (
            <div className="h-full">
              <MapView 
                searchQuery={searchQuery} 
                radius={radius} 
                filteredEvents={filteredEvents}
                onFilteredEventsChange={handleFilteredEventsChange}
              />
            </div>
          ) : (
            <div className="h-full overflow-auto pb-20 pt-2 px-4">
              <EventList 
                searchQuery={searchQuery} 
                radius={radius} 
                filteredEvents={filteredEvents} 
                gridView={true}
              />
            </div>
          )}
        </div>
      )}
      
      <App2BottomNav />
    </div>
  );
}

export default App2Layout;