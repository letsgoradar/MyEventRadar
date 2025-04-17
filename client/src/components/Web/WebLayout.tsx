import * as React from "react";
import { Event } from "@shared/schema";
import Sidebar from "./Sidebar";
import Header from "./Header";
import SplitView from "./SplitView";

interface WebLayoutProps {
  children?: React.ReactNode;
  searchQuery?: string;
  radius?: number;
  filteredEvents?: Event[];
  onSearch?: (query: string) => void;
  onRadiusChange?: (radius: number) => void;
  onFilteredEventsChange?: (events: Event[]) => void;
}

export function WebLayout({ 
  children,
  searchQuery: propSearchQuery,
  radius: propRadius,
  filteredEvents: propFilteredEvents,
  onSearch: propOnSearch,
  onRadiusChange: propOnRadiusChange,
  onFilteredEventsChange: propOnFilteredEventsChange
}: WebLayoutProps) {
  // In de web-omgeving gebruiken we altijd de split view (geen toggle)
  const [searchQuery, setSearchQuery] = React.useState(propSearchQuery || "");
  const [radius, setRadius] = React.useState(propRadius || 10);
  const [filteredEvents, setFilteredEvents] = React.useState<Event[]>(propFilteredEvents || []);
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);

  // Update state when props change
  React.useEffect(() => {
    if (propSearchQuery !== undefined) setSearchQuery(propSearchQuery);
  }, [propSearchQuery]);

  React.useEffect(() => {
    if (propRadius !== undefined) setRadius(propRadius);
  }, [propRadius]);

  React.useEffect(() => {
    if (propFilteredEvents) {
      // Filter events based on selected categories
      if (selectedCategories.length > 0) {
        const filtered = propFilteredEvents.filter(event => 
          selectedCategories.includes(event.category)
        );
        setFilteredEvents(filtered);
      } else {
        setFilteredEvents(propFilteredEvents);
      }
    }
  }, [propFilteredEvents, selectedCategories]);

  const handleSearch = React.useCallback((query: string) => {
    setSearchQuery(query);
    propOnSearch?.(query);
  }, [propOnSearch]);

  const handleRadiusChange = React.useCallback((value: number) => {
    setRadius(value);
    propOnRadiusChange?.(value);
  }, [propOnRadiusChange]);

  const handleFilteredEventsChange = React.useCallback((events: Event[]) => {
    setFilteredEvents(events);
    propOnFilteredEventsChange?.(events);
  }, [propOnFilteredEventsChange]);
  
  const handleCategoriesChange = React.useCallback((categories: string[]) => {
    setSelectedCategories(categories);
  }, []);

  // Alleen desktop layout met sidebar en split view
  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col relative w-[calc(100vw-260px)]">
        {/* Header in een eigen fixed container */}
        <div className="sticky top-0 left-0 right-0 z-[100]">
          <Header 
            isMapView={true} // Always true in web view since we're using SplitView
            toggleView={() => {}} // Empty function since we don't need this in web view
            onSearch={handleSearch}
            radius={radius}
            onRadiusChange={handleRadiusChange}
            onCategoriesChange={handleCategoriesChange}
            hideViewToggle={true} // Hide the toggle button in web view
          />
        </div>
        
        {/* Content container met vaste top margin zodat de kaart niet onder de header komt */}
        <div className="flex-1 relative overflow-hidden">
          {children ? (
            <div className="h-full overflow-y-auto p-4 pb-20 max-w-screen-2xl mx-auto">{children}</div>
          ) : (
            <SplitView 
              searchQuery={searchQuery}
              radius={radius}
              filteredEvents={filteredEvents}
              onRadiusChange={handleRadiusChange}
              onFilteredEventsChange={handleFilteredEventsChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default WebLayout;